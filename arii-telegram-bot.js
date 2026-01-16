// Bot Telegram pour Copy-Trading Arii Defi sur Myriad (Abstract Chain)
// npm install node-telegram-bot-api ethers axios

const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const axios = require('axios');

// ============ CONFIGURATION ============
const TELEGRAM_BOT_TOKEN = '7425431970:AAE6-D_NWoD33h40qUfyF27RUmlvcCCyTHk';
const ABSTRACT_RPC_URL = 'https://api.mainnet.abs.xyz';
const ARII_WALLET = '0x2993249a3d107b759c886a4bd4e02b70d471ea9b';
const MYRIAD_API = 'https://api.myriad.markets'; // À vérifier
const ABSTRACT_EXPLORER = 'https://abscan.org';

// ============ INITIALISATION ============
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const provider = new ethers.JsonRpcProvider(ABSTRACT_RPC_URL);

// Stockage des utilisateurs et leurs préférences
const users = new Map();
const activeBets = [];

// ============ FONCTIONS UTILITAIRES ============

// Récupère les dernières activités d'Arii depuis Myriad
async function fetchAriiActivity() {
    try {
        const response = await axios.get(
            `${MYRIAD_API}/profile/${ARII_WALLET}/activity`,
            { timeout: 10000 }
        );
        return response.data;
    } catch (error) {
        console.error('Erreur API Myriad:', error.message);
        // Fallback: surveiller directement la blockchain
        return await monitorBlockchain();
    }
}

// Surveille la blockchain Abstract pour les transactions d'Arii
async function monitorBlockchain() {
    try {
        const latestBlock = await provider.getBlockNumber();
        const block = await provider.getBlock(latestBlock, true);
        
        if (!block || !block.transactions) return [];
        
        const ariiTxs = [];
        for (const tx of block.transactions) {
            if (typeof tx === 'object' && tx.from?.toLowerCase() === ARII_WALLET.toLowerCase()) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                ariiTxs.push({
                    hash: tx.hash,
                    to: tx.to,
                    value: ethers.formatEther(tx.value || '0'),
                    data: tx.data,
                    receipt: receipt
                });
            }
        }
        return ariiTxs;
    } catch (error) {
        console.error('Erreur monitoring blockchain:', error.message);
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
                    
                    // Notifie tous les utilisateurs
                    for (const [chatId, settings] of users.entries()) {
                        if (!settings.notifications) continue;
                        
                        const message = formatBetNotification(betInfo);
                        const keyboard = createBetKeyboard(betInfo.id);
                        
                        bot.sendMessage(chatId, message, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        });
                        
                        // Auto-copy si activé
                        if (settings.autoCopy && settings.walletAddress) {
                            bot.sendMessage(chatId, '🤖 Auto-copy activé! Instructions envoyées...');
                        }
                    }
                    
                    console.log(`✅ Nouveau bet détecté: ${betInfo.id}`);
                }
            }
        } catch (error) {
            console.error('Erreur monitoring:', error.message);
        }
    }, 15000); // Vérification toutes les 15 secondes
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