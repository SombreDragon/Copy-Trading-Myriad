// Bot Telegram avec Monitoring Auto toutes les 5 minutes
// npm install node-telegram-bot-api express axios cheerio

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

// ============ CONFIGURATION ============
const TELEGRAM_BOT_TOKEN = '7425431970:AAE6-D_NWoD33h40qUfyF27RUmlvcCCyTHk';
const ARII_WALLET = '0x2993249a3d107b759c886a4bd4e02b70d471ea9b';
const MYRIAD_PROFILE_URL = `https://myriad.markets/profile/${ARII_WALLET}?tab=activity`;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes en millisecondes
const PORT = process.env.PORT || 3000;

// ============ INITIALISATION ============
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const app = express();

app.use(express.json());

// Stockage
const users = new Map();
const knownBets = new Set(); // IDs des bets déjà vus
let lastCheckTime = null;
let lastBetDetected = null;
let monitoringActive = false;

// ============ SCRAPING MYRIAD ============

async function fetchAriiActivity() {
    try {
        console.log('🔍 Vérification de l\'activité d\'Arii...');
        
        const response = await axios.get(MYRIAD_PROFILE_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        
        const $ = cheerio.load(response.data);
        const bets = [];
        
        // Cherche les éléments de bet dans le HTML
        // Note: La structure peut varier, on cherche des patterns communs
        $('[data-testid*="bet"], [class*="bet"], [class*="trade"], [class*="position"]').each((i, elem) => {
            try {
                const $elem = $(elem);
                const text = $elem.text();
                const dataId = $elem.attr('data-id') || $elem.attr('id');
                
                // Extrait les infos du bet
                if (text && (text.includes('ETH') || text.includes('USDC') || text.includes('bought') || text.includes('sold'))) {
                    bets.push({
                        id: dataId || `bet_${Date.now()}_${i}`,
                        text: text.trim(),
                        html: $elem.html(),
                        timestamp: Date.now()
                    });
                }
            } catch (err) {
                console.log('⚠️ Erreur parsing bet:', err.message);
            }
        });
        
        console.log(`✅ ${bets.length} activités trouvées`);
        return bets;
        
    } catch (error) {
        console.log('⚠️ Erreur scraping:', error.message);
        return [];
    }
}

function parseBetInfo(betData) {
    // Extrait les infos pertinentes du texte
    const text = betData.text;
    
    // Cherche le montant
    const amountMatch = text.match(/(\d+\.?\d*)\s*(ETH|USDC|USD)/i);
    const amount = amountMatch ? `${amountMatch[1]} ${amountMatch[2]}` : 'Montant inconnu';
    
    // Cherche le type d'action
    const action = text.toLowerCase().includes('bought') ? 'Achat' : 
                   text.toLowerCase().includes('sold') ? 'Vente' : 'Trade';
    
    // Cherche le marché (texte avant le montant généralement)
    const marketMatch = text.split(/bought|sold|traded/i)[0].trim();
    const market = marketMatch.slice(0, 100) || 'Marché non spécifié';
    
    return {
        id: betData.id,
        amount,
        action,
        market,
        timestamp: betData.timestamp,
        fullText: text
    };
}

// ============ MONITORING AUTOMATIQUE ============

async function startMonitoring() {
    if (monitoringActive) {
        console.log('⚠️ Monitoring déjà actif');
        return;
    }
    
    monitoringActive = true;
    console.log('🚀 Monitoring automatique démarré!');
    console.log(`⏱️ Vérification toutes les ${CHECK_INTERVAL / 60000} minutes`);
    
    // Première vérification immédiate
    await checkForNewBets();
    
    // Puis vérifications régulières
    setInterval(async () => {
        await checkForNewBets();
    }, CHECK_INTERVAL);
}

async function checkForNewBets() {
    try {
        lastCheckTime = new Date();
        const activities = await fetchAriiActivity();
        
        if (activities.length === 0) {
            console.log('📭 Aucune activité détectée');
            return;
        }
        
        // Vérifie les nouveaux bets
        const newBets = activities.filter(bet => !knownBets.has(bet.id));
        
        if (newBets.length > 0) {
            console.log(`🆕 ${newBets.length} nouveau(x) bet(s) détecté(s)!`);
            
            for (const betData of newBets) {
                knownBets.add(betData.id);
                const betInfo = parseBetInfo(betData);
                lastBetDetected = betInfo;
                
                // Notifie tous les utilisateurs
                await notifyAllUsers(betInfo);
            }
        } else {
            console.log('✅ Aucun nouveau bet');
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de la vérification:', error.message);
    }
}

async function notifyAllUsers(bet) {
    const message = `
🚨 *NOUVEAU ${bet.action.toUpperCase()} D'ARII!*

💰 *Montant:* ${bet.amount}
📊 *Marché:* ${bet.market}
⏰ *Détecté:* ${new Date().toLocaleTimeString('fr-FR')}

🔗 [Voir sur Myriad](${MYRIAD_PROFILE_URL})
`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📊 Ouvrir Myriad', url: MYRIAD_PROFILE_URL },
                { text: '✅ J\'ai vu', callback_data: `seen_${bet.id}` }
            ],
            [
                { text: '📝 Voir Détails', callback_data: `details_${bet.id}` }
            ]
        ]
    };
    
    let notifiedCount = 0;
    for (const [chatId, settings] of users.entries()) {
        if (!settings.notifications) continue;
        
        try {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: false
            });
            notifiedCount++;
        } catch (error) {
            console.log(`⚠️ Erreur notification ${chatId}:`, error.message);
        }
    }
    
    console.log(`📤 ${notifiedCount} utilisateur(s) notifié(s)`);
}

// ============ SERVEUR WEB ============

app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime() / 60);
    const nextCheck = lastCheckTime ? 
        new Date(lastCheckTime.getTime() + CHECK_INTERVAL) : 
        new Date(Date.now() + CHECK_INTERVAL);
    
    res.send(`
        <html>
        <head>
            <title>Arii Copy Bot</title>
            <meta http-equiv="refresh" content="30">
            <style>
                body { font-family: Arial; padding: 40px; background: #1a1a1a; color: #fff; }
                .status-ok { color: #0f0; }
                .status-info { color: #4da6ff; }
                h1 { color: #4da6ff; }
                .card { background: #2a2a2a; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .stat { margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>🤖 Bot Telegram Arii Copy Trader</h1>
            
            <div class="card">
                <h2>📊 Statut</h2>
                <div class="stat">✅ Status: <strong class="status-ok">ONLINE</strong></div>
                <div class="stat">🔄 Monitoring: <strong class="status-ok">${monitoringActive ? 'ACTIF' : 'INACTIF'}</strong></div>
                <div class="stat">👥 Utilisateurs: <strong>${users.size}</strong></div>
                <div class="stat">⏰ Uptime: <strong>${uptime} minutes</strong></div>
            </div>
            
            <div class="card">
                <h2>🔍 Monitoring</h2>
                <div class="stat">⏱️ Intervalle: <strong>5 minutes</strong></div>
                <div class="stat">📅 Dernière vérif: <strong>${lastCheckTime ? lastCheckTime.toLocaleTimeString('fr-FR') : 'Jamais'}</strong></div>
                <div class="stat">⏭️ Prochaine vérif: <strong>${nextCheck.toLocaleTimeString('fr-FR')}</strong></div>
                <div class="stat">📊 Bets trackés: <strong>${knownBets.size}</strong></div>
            </div>
            
            ${lastBetDetected ? `
            <div class="card">
                <h2>🎯 Dernier Bet Détecté</h2>
                <div class="stat">💰 Montant: <strong>${lastBetDetected.amount}</strong></div>
                <div class="stat">🎬 Action: <strong>${lastBetDetected.action}</strong></div>
                <div class="stat">⏰ Détecté: <strong>${new Date(lastBetDetected.timestamp).toLocaleString('fr-FR')}</strong></div>
            </div>
            ` : ''}
            
            <div class="card">
                <h2>📱 Utilisation</h2>
                <ol>
                    <li>Ouvre Telegram</li>
                    <li>Cherche ton bot</li>
                    <li>Lance /start</li>
                    <li>Reçois les alertes automatiquement!</li>
                </ol>
                <p class="status-info">🔗 <a href="${MYRIAD_PROFILE_URL}" style="color: #4da6ff;">Voir le profil d'Arii</a></p>
            </div>
            
            <p style="margin-top: 40px; color: #666;">Auto-refresh toutes les 30s</p>
        </body>
        </html>
    `);
});

app.get('/stats', (req, res) => {
    res.json({
        status: 'online',
        monitoring: monitoringActive,
        users: users.size,
        betsTracked: knownBets.size,
        lastCheck: lastCheckTime,
        uptime: Math.floor(process.uptime()),
        lastBet: lastBetDetected
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web sur le port ${PORT}`);
});

// ============ COMMANDES BOT ============

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'ami';
    
    users.set(chatId, {
        notifications: true,
        joinedAt: Date.now()
    });
    
    bot.sendMessage(chatId, `
👋 *Bienvenue ${firstName}!*

🎯 *Bot Arii Copy Trader - Alertes Auto*

✅ Tu es maintenant inscrit aux alertes!
🔔 Tu recevras une notification à chaque nouveau bet d'Arii
⏱️ Vérification automatique toutes les 5 minutes

📱 *Commandes:*
/status - Voir le statut du monitoring
/test - Tester une alerte
/settings - Paramètres
/help - Aide

🚀 *C'est tout!* Le bot surveille automatiquement.
Tu n'as plus rien à faire, détends-toi! 😎
`, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    const nextCheck = lastCheckTime ? 
        new Date(lastCheckTime.getTime() + CHECK_INTERVAL) : 
        new Date(Date.now() + CHECK_INTERVAL);
    
    const statusMsg = `
📊 *STATUT DU BOT*

🔄 *Monitoring:* ${monitoringActive ? '🟢 ACTIF' : '🔴 INACTIF'}
⏱️ *Intervalle:* 5 minutes
📅 *Dernière vérif:* ${lastCheckTime ? lastCheckTime.toLocaleTimeString('fr-FR') : 'Jamais'}
⏭️ *Prochaine vérif:* ${nextCheck.toLocaleTimeString('fr-FR')}

👥 *Utilisateurs actifs:* ${users.size}
📊 *Bets trackés:* ${knownBets.size}
⏰ *Uptime:* ${Math.floor(process.uptime() / 60)} minutes

${lastBetDetected ? `
🎯 *Dernier bet:*
💰 ${lastBetDetected.amount}
🎬 ${lastBetDetected.action}
⏰ ${new Date(lastBetDetected.timestamp).toLocaleString('fr-FR')}
` : '📭 Aucun bet détecté pour l\'instant'}
`;
    
    bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    
    const testBet = {
        id: `test_${Date.now()}`,
        amount: '0.5 ETH',
        action: 'Achat',
        market: 'Bitcoin > $100k en 2025',
        timestamp: Date.now()
    };
    
    const message = `
🧪 *ALERTE TEST*

🚨 *NOUVEL ACHAT D'ARII!*

💰 *Montant:* ${testBet.amount}
📊 *Marché:* ${testBet.market}
⏰ *Détecté:* ${new Date().toLocaleTimeString('fr-FR')}

🔗 [Voir sur Myriad](${MYRIAD_PROFILE_URL})

_Ceci est une alerte de test. Les vraies alertes auront le même format!_
`;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '📊 Ouvrir Myriad', url: MYRIAD_PROFILE_URL }
            ]]
        }
    });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, `
📖 *AIDE COMPLÈTE*

🤖 *Comment ça marche?*
Le bot vérifie automatiquement le profil d'Arii toutes les 5 minutes. Dès qu'un nouveau bet est détecté, tu reçois une alerte instantanée!

🔔 *Notifications:*
• Automatiques toutes les 5 min
• Infos: montant, marché, action
• Lien direct vers Myriad

📱 *Commandes:*
/start - S'inscrire
/status - Voir le statut
/test - Tester une alerte
/settings - Paramètres
/help - Cette aide

⚙️ *Paramètres:*
Utilise /settings pour activer/désactiver les notifications

🆘 *Problème?*
Si tu ne reçois pas d'alertes, vérifie que:
1. Tu as fait /start
2. Les notifications sont activées
3. Le bot est en ligne (/status)

🔗 *Liens:*
[Profil Arii](${MYRIAD_PROFILE_URL})
[Myriad Markets](https://myriad.markets)
`, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });
});

bot.onText(/\/settings/, (msg) => {
    const chatId = msg.chat.id;
    const settings = users.get(chatId) || { notifications: true };
    
    bot.sendMessage(chatId, 
        `⚙️ *PARAMÈTRES*\n\nClique pour modifier:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: settings.notifications ? '🔔 Notifs: ON' : '🔕 Notifs: OFF', 
                        callback_data: 'toggle_notifs' 
                    }
                ]]
            }
        }
    );
});

// ============ CALLBACKS ============

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data === 'toggle_notifs') {
        const settings = users.get(chatId) || { notifications: true };
        settings.notifications = !settings.notifications;
        users.set(chatId, settings);
        
        bot.answerCallbackQuery(query.id, {
            text: `Notifications ${settings.notifications ? 'activées ✅' : 'désactivées ❌'}!`
        });
        
        bot.editMessageText(
            `⚙️ *PARAMÈTRES*\n\nNotifications: ${settings.notifications ? '🔔 ON' : '🔕 OFF'}`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: settings.notifications ? '🔔 Notifs: ON' : '🔕 Notifs: OFF', 
                            callback_data: 'toggle_notifs' 
                        }
                    ]]
                }
            }
        );
    } else if (data.startsWith('seen_')) {
        bot.answerCallbackQuery(query.id, { text: '✅ Noté!' });
    } else if (data.startsWith('details_')) {
        if (lastBetDetected) {
            bot.sendMessage(chatId, 
                `📝 *Détails:*\n\n${lastBetDetected.fullText || 'Pas de détails supplémentaires'}`,
                { parse_mode: 'Markdown' }
            );
        }
        bot.answerCallbackQuery(query.id);
    }
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

console.log('🤖 Bot Telegram Arii Copy Trader');
console.log(`📱 Token: ${TELEGRAM_BOT_TOKEN.slice(0, 20)}...`);
console.log(`👤 Wallet Arii: ${ARII_WALLET}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`⏱️ Intervalle de vérification: ${CHECK_INTERVAL / 60000} minutes`);

bot.getMe().then(me => {
    console.log(`✅ Bot connecté: @${me.username}`);
    console.log('📡 En attente de messages...');
    
    // Démarre le monitoring automatique
    setTimeout(() => {
        startMonitoring();
    }, 3000); // Attends 3 secondes avant de démarrer
});
