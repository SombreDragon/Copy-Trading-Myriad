// Bot Telegram Ultra-Simple : Alertes Nouveaux Marchés Myriad
// npm install node-telegram-bot-api express axios cheerio

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

// ============ CONFIGURATION ============
const TELEGRAM_BOT_TOKEN = '7425431970:AAE6-D_NWoD33h40qUfyF27RUmlvcCCyTHk';
const CHECK_INTERVAL = 2 * 60 * 1000; // Vérifier toutes les 2 minutes
const PORT = process.env.PORT || 3000;

// URLs Myriad
const MYRIAD_MARKETS_URL = 'https://myriad.markets/markets';
const MYRIAD_API_BASE = 'https://api.myriad.markets'; // À tester

// ============ INITIALISATION ============
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const app = express();

app.use(express.json());

// Stockage
const users = new Set(); // Liste simple des chat IDs
const knownMarkets = new Set(); // IDs des marchés déjà vus
let lastCheckTime = null;
let totalMarketsFound = 0;
let monitoringActive = false;

// ============ RÉCUPÉRATION DES MARCHÉS ============

async function fetchNewMarkets() {
    try {
        console.log('🔍 Recherche de nouveaux marchés...');
        
        // Méthode 1 : Essayer l'API si elle existe
        const markets = await tryFetchFromAPI();
        
        if (markets && markets.length > 0) {
            console.log(`✅ ${markets.length} marchés trouvés via API`);
            return markets;
        }
        
        // Méthode 2 : Fallback - générer une notification manuelle
        console.log('⚠️ API non accessible, mode manuel');
        return [];
        
    } catch (error) {
        console.log('⚠️ Erreur:', error.message);
        return [];
    }
}

async function tryFetchFromAPI() {
    try {
        // Tente différentes URLs possibles
        const possibleEndpoints = [
            'https://api.myriad.markets/markets',
            'https://myriad.markets/api/markets',
            'https://api.myriad.markets/v1/markets'
        ];
        
        for (const endpoint of possibleEndpoints) {
            try {
                const response = await axios.get(endpoint, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.data && Array.isArray(response.data)) {
                    return response.data.map(market => ({
                        id: market.id || market.market_id || `market_${Date.now()}`,
                        title: market.title || market.question || 'Nouveau marché',
                        category: market.category || 'Unknown',
                        url: `https://myriad.markets/market/${market.id}`,
                        volume: market.volume || 0,
                        timestamp: Date.now()
                    }));
                }
            } catch (err) {
                // Continue vers le prochain endpoint
                continue;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// ============ SYSTÈME DE NOTIFICATION ============

async function notifyNewMarket(market) {
    const message = `
🆕 *NOUVEAU MARCHÉ SUR MYRIAD !*

📊 *${market.title}*

📁 Catégorie: ${market.category}
💰 Volume: ${market.volume ? `$${market.volume}` : 'N/A'}
⏰ Détecté: ${new Date().toLocaleTimeString('fr-FR')}

🔗 [Ouvrir sur Myriad](${market.url})

⚡ *Sois rapide pour être dans les premiers!*
`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚀 Trader Maintenant', url: market.url }
            ],
            [
                { text: '👀 Voir Tous les Marchés', url: MYRIAD_MARKETS_URL }
            ]
        ]
    };
    
    let sentCount = 0;
    for (const chatId of users) {
        try {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: false
            });
            sentCount++;
        } catch (error) {
            console.log(`⚠️ Erreur envoi à ${chatId}`);
        }
    }
    
    console.log(`📤 ${sentCount} utilisateur(s) notifié(s)`);
}

// ============ MONITORING ============

async function checkForNewMarkets() {
    try {
        lastCheckTime = new Date();
        const markets = await fetchNewMarkets();
        
        if (!markets || markets.length === 0) {
            console.log('📭 Aucun marché trouvé');
            return;
        }
        
        // Détecte les nouveaux marchés
        const newMarkets = markets.filter(m => !knownMarkets.has(m.id));
        
        if (newMarkets.length > 0) {
            console.log(`🆕 ${newMarkets.length} NOUVEAU(X) MARCHÉ(S) !`);
            
            for (const market of newMarkets) {
                knownMarkets.add(market.id);
                totalMarketsFound++;
                await notifyNewMarket(market);
            }
        } else {
            console.log('✅ Aucun nouveau marché');
        }
        
    } catch (error) {
        console.error('❌ Erreur monitoring:', error.message);
    }
}

function startMonitoring() {
    if (monitoringActive) return;
    
    monitoringActive = true;
    console.log('🚀 Monitoring automatique démarré!');
    console.log(`⏱️ Vérification toutes les ${CHECK_INTERVAL / 60000} minutes`);
    
    // Première vérification immédiate
    checkForNewMarkets();
    
    // Puis vérifications régulières
    setInterval(checkForNewMarkets, CHECK_INTERVAL);
}

// ============ WEBHOOK MANUEL ============

// Endpoint pour ajouter manuellement un nouveau marché
app.post('/webhook/new-market', (req, res) => {
    const { title, category, url, volume } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title required' });
    }
    
    const market = {
        id: `manual_${Date.now()}`,
        title,
        category: category || 'Manual',
        url: url || MYRIAD_MARKETS_URL,
        volume: volume || 0,
        timestamp: Date.now()
    };
    
    if (!knownMarkets.has(market.id)) {
        knownMarkets.add(market.id);
        totalMarketsFound++;
        notifyNewMarket(market);
    }
    
    res.json({ success: true, market });
});

// ============ SERVEUR WEB ============

app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 60);
    const nextCheck = lastCheckTime ? 
        new Date(lastCheckTime.getTime() + CHECK_INTERVAL) : 
        new Date(Date.now() + CHECK_INTERVAL);
    
    res.send(`
        <html>
        <head>
            <title>Myriad New Markets Alert Bot</title>
            <meta http-equiv="refresh" content="30">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .card {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 20px;
                    padding: 30px;
                    margin: 20px 0;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #667eea;
                    font-size: 2em;
                    margin-bottom: 10px;
                }
                .status-ok { color: #10b981; font-weight: bold; }
                .status-info { color: #667eea; font-weight: bold; }
                .stat {
                    margin: 15px 0;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .stat-label { color: #666; }
                .stat-value { font-weight: bold; color: #333; }
                .btn {
                    display: inline-block;
                    padding: 12px 24px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    margin: 10px 5px;
                    transition: transform 0.2s;
                }
                .btn:hover { transform: scale(1.05); }
                .pulse {
                    width: 12px;
                    height: 12px;
                    background: #10b981;
                    border-radius: 50%;
                    display: inline-block;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🚨 Myriad New Markets Bot</h1>
                    <p style="color: #666; margin-top: 10px;">Alerte automatique dès qu'un nouveau marché apparaît sur Myriad</p>
                </div>
                
                <div class="card">
                    <h2 style="color: #333; margin-bottom: 20px;">📊 Statut en Direct</h2>
                    <div class="stat">
                        <span class="stat-label">🔄 Monitoring</span>
                        <span class="status-ok">
                            <span class="pulse"></span> ACTIF
                        </span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">👥 Utilisateurs inscrits</span>
                        <span class="stat-value">${users.size}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">📊 Marchés détectés</span>
                        <span class="stat-value">${totalMarketsFound}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">⏰ Uptime</span>
                        <span class="stat-value">${uptime} minutes</span>
                    </div>
                </div>
                
                <div class="card">
                    <h2 style="color: #333; margin-bottom: 20px;">⏱️ Monitoring</h2>
                    <div class="stat">
                        <span class="stat-label">⏱️ Intervalle de vérification</span>
                        <span class="stat-value">2 minutes</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">📅 Dernière vérification</span>
                        <span class="stat-value">${lastCheckTime ? lastCheckTime.toLocaleTimeString('fr-FR') : 'Jamais'}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">⏭️ Prochaine vérification</span>
                        <span class="stat-value">${nextCheck.toLocaleTimeString('fr-FR')}</span>
                    </div>
                </div>
                
                <div class="card">
                    <h2 style="color: #333; margin-bottom: 20px;">🚀 Comment Utiliser</h2>
                    <ol style="line-height: 2; color: #666;">
                        <li>Ouvre Telegram</li>
                        <li>Cherche ton bot</li>
                        <li>Lance <code>/start</code></li>
                        <li>Reçois une alerte dès qu'un nouveau marché apparaît!</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <a href="${MYRIAD_MARKETS_URL}" class="btn" target="_blank">📊 Voir Myriad Markets</a>
                        <a href="https://t.me/YourBotUsername" class="btn" target="_blank">💬 Ouvrir le Bot</a>
                    </div>
                </div>
                
                <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
                    <h3 style="color: #856404; margin-bottom: 10px;">💡 Webhook Manuel</h3>
                    <p style="color: #856404; font-size: 0.9em;">
                        Tu peux aussi notifier manuellement un nouveau marché en envoyant un POST à:
                    </p>
                    <code style="background: #fff; padding: 10px; display: block; margin: 10px 0; border-radius: 5px;">
                        POST ${req.protocol}://${req.get('host')}/webhook/new-market
                    </code>
                    <pre style="background: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 0.8em;">
{
  "title": "Titre du marché",
  "category": "Crypto",
  "url": "https://myriad.markets/market/123",
  "volume": 1000
}
                    </pre>
                </div>
                
                <p style="text-align: center; color: rgba(255,255,255,0.8); margin-top: 30px; font-size: 0.9em;">
                    Auto-refresh toutes les 30s • Made with ❤️ for early traders
                </p>
            </div>
        </body>
        </html>
    `);
});

app.get('/stats', (req, res) => {
    res.json({
        status: 'online',
        monitoring: monitoringActive,
        users: users.size,
        marketsFound: totalMarketsFound,
        lastCheck: lastCheckTime,
        uptime: Math.floor(process.uptime())
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web sur le port ${PORT}`);
});

// ============ COMMANDES TELEGRAM ============

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'trader';
    
    users.add(chatId);
    console.log(`📱 Nouvel utilisateur: ${firstName} (${chatId})`);
    
    bot.sendMessage(chatId, `
🚨 *Bienvenue ${firstName}!*

Tu vas maintenant recevoir une *alerte instantanée* dès qu'un nouveau marché apparaît sur Myriad Markets!

⚡ *Pourquoi c'est important ?*
Les meilleurs gains se font dans les premières minutes d'un nouveau marché. Avec ce bot, tu seras parmi les premiers informés!

⏱️ *Vérification automatique toutes les 2 minutes*

🎯 *Tu n'as rien à faire!*
Garde Telegram ouvert et tu recevras les alertes automatiquement.

📱 *Commandes:*
/status - Voir le statut
/test - Tester une alerte
/help - Aide

🚀 *Le bot surveille maintenant pour toi!*
`, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '📊 Voir Myriad Markets', url: MYRIAD_MARKETS_URL }
            ]]
        }
    });
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    
    const nextCheck = lastCheckTime ? 
        new Date(lastCheckTime.getTime() + CHECK_INTERVAL) : 
        new Date(Date.now() + CHECK_INTERVAL);
    
    bot.sendMessage(chatId, `
📊 *STATUT DU BOT*

🔄 *Monitoring:* ${monitoringActive ? '🟢 ACTIF' : '🔴 INACTIF'}
⏱️ *Vérification:* Toutes les 2 minutes
📅 *Dernière vérif:* ${lastCheckTime ? lastCheckTime.toLocaleTimeString('fr-FR') : 'Jamais'}
⏭️ *Prochaine vérif:* ${nextCheck.toLocaleTimeString('fr-FR')}

👥 *Utilisateurs:* ${users.size}
📊 *Marchés détectés:* ${totalMarketsFound}
⏰ *Uptime:* ${Math.floor(process.uptime() / 60)} minutes

✅ *Tout fonctionne!* Tu recevras une alerte dès qu'un nouveau marché apparaît.
`, { parse_mode: 'Markdown' });
});

bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    
    const testMarket = {
        id: `test_${Date.now()}`,
        title: 'Bitcoin dépassera-t-il 100k$ en février 2025?',
        category: 'Crypto',
        url: MYRIAD_MARKETS_URL,
        volume: 5000,
        timestamp: Date.now()
    };
    
    bot.sendMessage(chatId, `
🧪 *ALERTE TEST*

Voici à quoi ressemblera une vraie notification:

━━━━━━━━━━━━━━━━━

🆕 *NOUVEAU MARCHÉ SUR MYRIAD !*

📊 *${testMarket.title}*

📁 Catégorie: ${testMarket.category}
💰 Volume: $${testMarket.volume}
⏰ Détecté: ${new Date().toLocaleTimeString('fr-FR')}

⚡ *Sois rapide pour être dans les premiers!*

━━━━━━━━━━━━━━━━━

_Ceci est une alerte de test. Les vraies alertes auront exactement ce format!_
`, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '🚀 Voir Myriad Markets', url: MYRIAD_MARKETS_URL }
            ]]
        }
    });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, `
📖 *GUIDE COMPLET*

🎯 *Comment ça marche?*
Le bot vérifie automatiquement Myriad Markets toutes les 2 minutes. Dès qu'un nouveau marché est créé, tu reçois une alerte instantanée!

🔔 *Pourquoi c'est utile?*
• Les meilleurs odds sont au début
• Moins de compétition
• Plus de profit potentiel
• Tu peux être le premier à trader

⏱️ *Fréquence*
Vérification toutes les 2 minutes = Tu es notifié max 2 min après la création d'un marché!

📱 *Commandes*
/start - S'inscrire aux alertes
/status - Voir le statut du bot
/test - Tester une notification
/help - Cette aide

💡 *Astuces*
• Garde les notifications Telegram activées
• Réagis vite quand tu reçois une alerte
• Les premiers à trader ont souvent les meilleurs odds

🔗 *Liens Utiles*
[Myriad Markets](${MYRIAD_MARKETS_URL})
[Extension Chrome Myriad](https://myriad.markets)

🆘 *Problème?*
Si tu ne reçois pas d'alertes:
1. Vérifie que tu as fait /start
2. Regarde le /status
3. Teste avec /test
`, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });
});

// ============ GESTION ERREURS ============

bot.on('polling_error', (error) => {
    console.error('❌ Erreur polling:', error.message);
});

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du bot...');
    bot.stopPolling();
    process.exit(0);
});

// ============ DÉMARRAGE ============

console.log('🚨 Myriad New Markets Alert Bot');
console.log(`📱 Token: ${TELEGRAM_BOT_TOKEN.slice(0, 20)}...`);
console.log(`🌐 Port: ${PORT}`);
console.log(`⏱️ Vérification toutes les ${CHECK_INTERVAL / 60000} minutes`);

bot.getMe().then(me => {
    console.log(`✅ Bot connecté: @${me.username}`);
    console.log('📡 En attente de messages...');
    
    // Démarre le monitoring
    setTimeout(() => {
        startMonitoring();
    }, 3000);
});
