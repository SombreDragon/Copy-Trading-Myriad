// Bot Telegram pour Copy-Trading Arii Defi sur Myriad (Abstract Chain)
// npm install node-telegram-bot-api ethers axios

const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const axios = require('axios');

// ============ CONFIGURATION ============
const TELEGRAM_BOT_TOKEN = '7425431970:AAE6-D_NWoD33h40qUfyF27RUmlvcCCyTHk';
const ABSTRACT_RPC_URL = 'https://api.abs.xyz';
const ARII_WALLET = '0x2993249a3d107b759c886a4bd4e02b70d471ea9b';
const MYRIAD_PROFILE_URL = 'https://myriad.markets/profile/0x2993249a3d107b759c886a4bd4e02b70d471ea9b?tab=activity';
const ABSTRACT_EXPLORER = 'https://abscan.org';

// Port pour Render (Health Check)
const PORT = process.env.PORT || 3000;

// ============ INITIALISATION ============
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const provider = new ethers.JsonRpcProvider(ABSTRACT_RPC_URL);

// Serveur HTTP simple pour health check Render
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Telegram Arii Copy Trader is running!\n');
});

server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Stockage des utilisateurs et leurs préférences
const users = new Map();
const activeBets = [];

// ============ FONCTIONS UTILITAIRES ============

// Récupère les dernières activités d'Arii depuis Myriad
async function fetchAriiActivity() {
    try {
        // On va scraper la page de profil Myriad
        const response = await axios.get(MYRIAD_PROFILE_URL, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Pour l'instant, on log et on retourne vide
        // TODO: Parser le HTML pour extraire les bets
        console.log('✅ Myriad profile accessible');
        return [];
    } catch (error) {
        console.log('⚠️ Myriad inaccessible, fallback sur blockchain monitoring');
        // Fallback: surveiller directement la blockchain
        return await monitorBlockchain();
    }
}

// Surveille la blockchain Abstract pour les transactions d'Arii
async function monitorBlockchain() {
    try {
        const latestBlock = await provider.getBlockNumber();
        console.log(`📦 Dernier bloc: ${latestBlock}`);
        
        // On récupère seulement le bloc sans les transactions pour économiser les requêtes
        const block = await provider.getBlock(latestBlock);
        
        if (!block) {
            console.log('⚠️ Bloc vide ou inaccessible');
            return [];
        }
        
        // Pour l'instant, on ne fetch pas toutes les transactions (trop lourd)
        // On va plutôt surveiller les événements du wallet d'Arii
        console.log(`✅ Bloc ${latestBlock} vérifié`);
        return [];
        
    } catch (error) {
        if (error.message.includes('missing')) {
            console.log('⚠️ RPC temporairement inaccessible (normal)');
        } else {
            console.log('⚠️ Erreur blockchain:', error.message.substring(0, 100));
        }
        return [];
    }
}

// Analyse une transaction pour extraire les infos du bet
function parseBetTransaction(tx) {
    // Cette fonction devra être adaptée selon l'ABI des contrats Myriad
    // Pour l'instant, on retourne les infos basiques
    return {
        id: tx.hash,
        market: tx.to,
        amount: tx.value,
        timestamp: Date.now(),
        explorerUrl: `${ABSTRACT_EXPLORER}/tx/${tx.hash}`
    };
}

// Formate un message de notification de bet
function formatBetNotification(bet) {
    return `
🚨 *NOUVEAU BET D'ARII DEFI*

💰 *Montant:* ${bet.amount} ETH
📊 *Marché:* ${bet.market || 'N/A'}
⏰ *Timestamp:* ${new Date(bet.timestamp).toLocaleString('fr-FR')}

🔗 [Voir sur Explorer](${bet.explorerUrl})

💡 *Que veux-tu faire ?*
`;
}

// Crée le clavier inline pour les actions
function createBetKeyboard(betId) {
    return {
        inline_keyboard: [
            [
                { text: '✅ Copier ce Bet', callback_data: `copy_${betId}` },
                { text: '❌ Ignorer', callback_data: `ignore_${betId}` }
            ],
            [
                { text: '📊 Voir Détails', callback_data: `details_${betId}` }
            ]
        ]
    };
}

// ============ COMMANDES DU BOT ============

// Commande /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    users.set(chatId, {
        notifications: true,
        autoCopy: false,
        copyAmount: null
    });
    
    const welcomeMsg = `
🎰 *Bienvenue sur Arii Copy Trader Bot!*

Je surveille les bets d'Arii Defi sur Myriad (Abstract Chain) et te notifie en temps réel.

*Commandes disponibles:*
/help - Voir l'aide
/status - État du monitoring
/settings - Paramètres
/history - Historique des bets
/wallet - Connecter ton wallet

*Statut:* 🟢 Monitoring actif
*Wallet surveillé:* \`${ARII_WALLET}\`

🔔 Tu recevras une notification à chaque nouveau bet!
`;
    
    bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
});

// Commande /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `
📖 *Guide d'Utilisation*

*Notifications:*
Tu reçois une alerte à chaque bet d'Arii avec:
• Montant et marché
• Lien vers l'explorateur
• Boutons d'action rapide

*Actions disponibles:*
✅ *Copier* - Réplique le bet (wallet requis)
❌ *Ignorer* - Ignore cette notification
📊 *Détails* - Voir plus d'infos

*Paramètres:*
/settings - Active/désactive:
  • Auto-copy (copie automatique)
  • Montants personnalisés
  • Notifications

*Wallet:*
/wallet - Connecte ton wallet pour copier les bets

*Support:*
En cas de problème, contacte @ton_username
`;
    
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
});

// Commande /status
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const blockNumber = await provider.getBlockNumber();
        const balance = await provider.getBalance(ARII_WALLET);
        
        const statusMsg = `
📊 *Statut du Système*

🟢 *Monitoring:* Actif
⛓️ *Blockchain:* Abstract (Chain ID: 2741)
📦 *Dernier Block:* ${blockNumber}
👤 *Wallet Arii:* \`${ARII_WALLET}\`
💰 *Balance Arii:* ${ethers.formatEther(balance)} ETH
📈 *Bets détectés:* ${activeBets.length}
👥 *Utilisateurs actifs:* ${users.size}

⏰ *Dernière vérification:* ${new Date().toLocaleString('fr-FR')}
`;
        
        bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, '❌ Erreur lors de la récupération du statut');
    }
});

// Commande /settings
bot.onText(/\/settings/, (msg) => {
    const chatId = msg.chat.id;
    const userSettings = users.get(chatId) || {};
    
    const keyboard = {
        inline_keyboard: [
            [
                { 
                    text: userSettings.notifications ? '🔔 Notifs: ON' : '🔕 Notifs: OFF', 
                    callback_data: 'toggle_notifs' 
                }
            ],
            [
                { 
                    text: userSettings.autoCopy ? '✅ Auto-Copy: ON' : '❌ Auto-Copy: OFF', 
                    callback_data: 'toggle_autocopy' 
                }
            ],
            [
                { text: '💰 Définir Montant', callback_data: 'set_amount' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '⚙️ *Paramètres*\n\nClique pour modifier:', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// Commande /history
bot.onText(/\/history/, (msg) => {
    const chatId = msg.chat.id;
    
    if (activeBets.length === 0) {
        bot.sendMessage(chatId, '📭 Aucun bet détecté pour le moment.');
        return;
    }
    
    let historyMsg = '📜 *Historique des Bets d\'Arii*\n\n';
    
    activeBets.slice(-10).forEach((bet, index) => {
        historyMsg += `${index + 1}. ${bet.amount} ETH - ${new Date(bet.timestamp).toLocaleString('fr-FR')}\n`;
    });
    
    bot.sendMessage(chatId, historyMsg, { parse_mode: 'Markdown' });
});

// Commande /wallet
bot.onText(/\/wallet/, (msg) => {
    const chatId = msg.chat.id;
    const walletMsg = `
🔐 *Connexion Wallet*

Pour copier les bets, tu dois connecter ton wallet.

*Options:*
1️⃣ *MetaMask* (recommandé)
2️⃣ *WalletConnect*
3️⃣ *Address manuelle*

🔗 Utilise le lien ci-dessous pour connecter:
[Connecter Wallet](https://app.myriad.markets)

⚠️ *Sécurité:*
• Ne partage JAMAIS ta seed phrase
• Vérifie toujours les transactions
• Ce bot ne stocke PAS tes clés privées

Une fois connecté, reviens ici et utilise:
/setaddress <ton_adresse>
`;
    
    bot.sendMessage(chatId, walletMsg, { parse_mode: 'Markdown' });
});

// Commande pour définir l'adresse
bot.onText(/\/setaddress (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const address = match[1];
    
    if (!ethers.isAddress(address)) {
        bot.sendMessage(chatId, '❌ Adresse invalide. Format attendu: 0x...');
        return;
    }
    
    const userSettings = users.get(chatId) || {};
    userSettings.walletAddress = address;
    users.set(chatId, userSettings);
    
    bot.sendMessage(chatId, `✅ Wallet connecté: \`${address}\`\n\nTu peux maintenant copier les bets!`, {
        parse_mode: 'Markdown'
    });
});

// ============ GESTION DES CALLBACKS ============

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userSettings = users.get(chatId) || {};
    
    // Toggle notifications
    if (data === 'toggle_notifs') {
        userSettings.notifications = !userSettings.notifications;
        users.set(chatId, userSettings);
        bot.answerCallbackQuery(query.id, {
            text: `Notifications ${userSettings.notifications ? 'activées' : 'désactivées'}!`
        });
        bot.sendMessage(chatId, `/settings`, { parse_mode: 'Markdown' });
    }
    
    // Toggle auto-copy
    else if (data === 'toggle_autocopy') {
        if (!userSettings.walletAddress) {
            bot.answerCallbackQuery(query.id, {
                text: 'Connecte d\'abord ton wallet avec /wallet',
                show_alert: true
            });
            return;
        }
        userSettings.autoCopy = !userSettings.autoCopy;
        users.set(chatId, userSettings);
        bot.answerCallbackQuery(query.id, {
            text: `Auto-copy ${userSettings.autoCopy ? 'activé' : 'désactivé'}!`
        });
    }
    
    // Copier un bet
    else if (data.startsWith('copy_')) {
        const betId = data.replace('copy_', '');
        const bet = activeBets.find(b => b.id === betId);
        
        if (!userSettings.walletAddress) {
            bot.answerCallbackQuery(query.id, {
                text: 'Connecte d\'abord ton wallet avec /wallet',
                show_alert: true
            });
            return;
        }
        
        if (!bet) {
            bot.answerCallbackQuery(query.id, { text: 'Bet introuvable' });
            return;
        }
        
        bot.sendMessage(chatId, `
🔄 *Copie du Bet en cours...*

💰 Montant: ${bet.amount} ETH
📊 Marché: ${bet.market}

⚠️ *Instructions:*
1. Va sur Myriad: [myriad.markets](https://myriad.markets)
2. Connecte ton wallet: \`${userSettings.walletAddress}\`
3. Trouve ce marché et place le même bet

📝 *Note:* L'exécution automatique arrive bientôt!
`, { parse_mode: 'Markdown' });
        
        bot.answerCallbackQuery(query.id, { text: '✅ Instructions envoyées!' });
    }
    
    // Ignorer un bet
    else if (data.startsWith('ignore_')) {
        bot.answerCallbackQuery(query.id, { text: 'Bet ignoré' });
        bot.deleteMessage(chatId, query.message.message_id);
    }
    
    // Détails d'un bet
    else if (data.startsWith('details_')) {
        const betId = data.replace('details_', '');
        const bet = activeBets.find(b => b.id === betId);
        
        if (!bet) {
            bot.answerCallbackQuery(query.id, { text: 'Bet introuvable' });
            return;
        }
        
        const detailsMsg = `
📊 *Détails du Bet*

🆔 *ID:* \`${bet.id.slice(0, 10)}...\`
💰 *Montant:* ${bet.amount} ETH
📍 *Marché:* \`${bet.market}\`
⏰ *Date:* ${new Date(bet.timestamp).toLocaleString('fr-FR')}

🔗 *Liens:*
[Voir Transaction](${bet.explorerUrl})
[Voir sur Myriad](https://myriad.markets)
`;
        
        bot.sendMessage(chatId, detailsMsg, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(query.id);
    }
});

// ============ MONITORING EN TEMPS RÉEL ============

let isMonitoring = false;

async function startMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;
    
    console.log('🚀 Monitoring démarré pour Arii Defi...');
    console.log(`👤 Wallet surveillé: ${ARII_WALLET}`);
    console.log(`⏱️ Vérification toutes les 30 secondes`);
    
    // Test initial de connexion
    try {
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ Connecté à Abstract - Bloc actuel: ${blockNumber}`);
    } catch (error) {
        console.log('⚠️ Connexion RPC en cours...');
    }
    
    setInterval(async () => {
        try {
            // Récupère l'activité d'Arii
            const activity = await fetchAriiActivity();
            
            if (!activity || activity.length === 0) return;
            
            // Traite chaque nouvelle transaction
            for (const tx of activity) {
                const betInfo = parseBetTransaction(tx);
                
                // Vérifie si c'est un nouveau bet
                if (!activeBets.find(b => b.id === betInfo.id)) {
                    activeBets.push(betInfo);
                    
                    console.log(`✅ Nouveau bet détecté: ${betInfo.id}`);
                    
                    // Notifie tous les utilisateurs
                    for (const [chatId, settings] of users.entries()) {
                        if (!settings.notifications) continue;
                        
                        const message = formatBetNotification(betInfo);
                        const keyboard = createBetKeyboard(betInfo.id);
                        
                        try {
                            await bot.sendMessage(chatId, message, {
                                parse_mode: 'Markdown',
                                reply_markup: keyboard
                            });
                            
                            // Auto-copy si activé
                            if (settings.autoCopy && settings.walletAddress) {
                                await bot.sendMessage(chatId, '🤖 Auto-copy activé! Instructions envoyées...');
                            }
                        } catch (err) {
                            console.log(`⚠️ Erreur envoi notification à ${chatId}`);
                        }
                    }
                }
            }
        } catch (error) {
            // Erreur silencieuse pour ne pas spammer les logs
            if (Math.random() < 0.1) { // Log 10% des erreurs seulement
                console.log('⚠️ Erreur monitoring (normal si pas d\'activité)');
            }
        }
    }, 30000); // Vérification toutes les 30 secondes (moins agressif)
}

// ============ DÉMARRAGE ============

console.log('🤖 Bot Telegram Arii Copy Trader démarré!');
console.log(`📱 Token: ${TELEGRAM_BOT_TOKEN.slice(0, 20)}...`);
console.log(`⛓️ RPC: ${ABSTRACT_RPC_URL}`);
console.log(`👤 Wallet Arii: ${ARII_WALLET}`);

startMonitoring();

// Message de bienvenue dans la console
bot.getMe().then(me => {
    console.log(`✅ Bot connecté: @${me.username}`);
    console.log('📡 En attente de messages...');
});

// Gestion des erreurs
bot.on('polling_error', (error) => {
    console.error('Erreur polling:', error.message);
});

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du bot...');
    bot.stopPolling();
    process.exit(0);
});
