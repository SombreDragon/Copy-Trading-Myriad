# 🤖 Bot Telegram Copy-Trading Arii Defi

Bot Telegram qui surveille les bets d'Arii Defi sur Myriad (Abstract Chain) et permet de les copier en temps réel.

## ✨ Fonctionnalités

### Phase 1 - Notifications ✅
- 🔔 Alertes en temps réel pour chaque nouveau bet d'Arii
- 📊 Détails complets: montant, marché, timestamp
- 🔗 Liens directs vers l'explorateur Abstract
- 📜 Historique des bets

### Phase 2 - Copy Trading 🚧
- ✅ Bouton "Copier ce Bet" sur chaque notification
- 🤖 Mode Auto-Copy (copie automatique)
- 💰 Montants personnalisés
- 🔐 Connexion wallet sécurisée

## 🚀 Installation

### Prérequis
- Node.js 18+ installé
- Un compte Telegram
- (Optionnel) Un serveur ou PC qui reste allumé 24/7

### Étapes d'Installation

#### 1. Télécharge les fichiers
Crée un nouveau dossier et copie les 2 fichiers:
- `bot.js` (le code du bot)
- `package.json` (les dépendances)

#### 2. Installe Node.js
Si pas déjà installé:
- **Windows/Mac**: https://nodejs.org (télécharge la version LTS)
- **Linux**: `sudo apt install nodejs npm`

#### 3. Installe les dépendances
Ouvre un terminal dans le dossier et tape:
```bash
npm install
```

#### 4. Lance le bot
```bash
npm start
```

Tu devrais voir:
```
🤖 Bot Telegram Arii Copy Trader démarré!
✅ Bot connecté: @ton_bot_username
📡 En attente de messages...
🚀 Monitoring démarré pour Arii Defi...
```

#### 5. Teste ton bot
1. Ouvre Telegram
2. Cherche ton bot (le nom que tu as donné à @BotFather)
3. Clique sur "Démarrer" ou tape `/start`
4. Tu devrais recevoir le message de bienvenue!

## 📱 Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `/start` | Démarrer le bot et s'inscrire aux notifications |
| `/help` | Afficher le guide d'utilisation |
| `/status` | Voir l'état du monitoring et les stats |
| `/settings` | Configurer les notifications et l'auto-copy |
| `/history` | Voir l'historique des bets d'Arii |
| `/wallet` | Instructions pour connecter ton wallet |
| `/setaddress <adresse>` | Enregistrer ton adresse wallet |

## ⚙️ Configuration

Le bot est déjà configuré avec:
- ✅ Token Telegram: Ton token
- ✅ RPC Abstract: `https://api.mainnet.abs.xyz`
- ✅ Wallet Arii: `0x2993249a3d107b759c886a4bd4e02b70d471ea9b`
- ✅ Chain ID: 2741 (Abstract)

### Pour modifier la configuration
Ouvre `bot.js` et modifie les lignes 7-11:
```javascript
const TELEGRAM_BOT_TOKEN = 'ton_token';
const ABSTRACT_RPC_URL = 'https://api.mainnet.abs.xyz';
const ARII_WALLET = '0x2993249a3d107b759c886a4bd4e02b70d471ea9b';
```

## 🎯 Comment Utiliser

### 1. Recevoir les Notifications
- Lance le bot avec `/start`
- Tu recevras automatiquement une alerte pour chaque nouveau bet d'Arii
- Chaque notification contient:
  - 💰 Le montant du bet
  - 📊 Le marché
  - ⏰ L'heure
  - 🔗 Un lien vers la transaction

### 2. Copier un Bet
**Méthode Manuelle:**
1. Clique sur "✅ Copier ce Bet"
2. Suis les instructions pour placer le même bet sur Myriad
3. Va sur https://myriad.markets
4. Connecte ton wallet
5. Place le même bet

**Méthode Auto-Copy (à venir):**
1. Utilise `/wallet` pour connecter ton wallet
2. Utilise `/settings` pour activer l'auto-copy
3. Définis un montant personnalisé si souhaité
4. Les bets seront copiés automatiquement!

### 3. Voir l'Historique
- Tape `/history` pour voir les 10 derniers bets
- Tape `/status` pour voir les stats en temps réel

## 🔧 Déploiement 24/7

Pour que le bot tourne en continu, plusieurs options:

### Option 1: Serveur VPS (Recommandé)
1. Loue un VPS (5-10€/mois):
   - DigitalOcean
   - Linode
   - Hetzner
   - OVH

2. Installe Node.js sur le serveur
3. Clone ton bot
4. Lance avec PM2 pour qu'il redémarre automatiquement:
```bash
npm install -g pm2
pm2 start bot.js --name arii-bot
pm2 startup
pm2 save
```

### Option 2: Hébergement Gratuit
- **Render.com** (gratuit avec limitations)
- **Railway.app** (5$ de crédit gratuit)
- **Fly.io** (gratuit pour petites apps)

### Option 3: PC Personnel
- Laisse ton PC/laptop allumé 24/7
- Configure pour qu'il ne se mette pas en veille
- Lance le bot au démarrage

## 🐛 Dépannage

### Le bot ne démarre pas
```bash
# Vérifie que Node.js est installé
node --version

# Réinstalle les dépendances
rm -rf node_modules
npm install
```

### Pas de notifications
- Vérifie que tu as fait `/start` dans le bot
- Vérifie que les notifications sont activées dans `/settings`
- Regarde les logs dans le terminal pour voir s'il y a des erreurs

### Erreur "polling_error"
- Ton token est peut-être invalide
- Un autre bot utilise peut-être le même token
- Arrête tous les autres bots qui tournent

### Le monitoring ne détecte rien
- Le RPC Abstract peut être temporairement down
- Arii n'a peut-être pas placé de bet récemment
- Vérifie le statut avec `/status`

## 📊 Améliorations Futures

### Phase 2 (en cours):
- [ ] Intégration Web3 complète
- [ ] Signature de transactions automatique
- [ ] Support MetaMask/WalletConnect
- [ ] Exécution automatique des bets

### Phase 3 (prévue):
- [ ] Multi-utilisateurs avec quotas
- [ ] Statistiques de performance
- [ ] Stop-loss et take-profit automatiques
- [ ] Notifications Discord en plus

## ⚠️ Avertissements

- **Ce bot est à des fins éducatives**
- **Trading de crypto comporte des risques**
- **Vérifie toujours les transactions avant de signer**
- **Ne partage JAMAIS tes clés privées**
- **Le bot ne stocke PAS tes clés**

## 💰 Frais et Coûts

- ✅ Bot Telegram: **Gratuit**
- ✅ RPC Abstract public: **Gratuit**
- ⚠️ Transactions sur Abstract: **Quelques centimes en ETH**
- 💡 Hébergement 24/7: **5-10€/mois (optionnel)**

## 🆘 Support

Des questions ? Des bugs ?
1. Vérifie d'abord ce README
2. Regarde les logs dans le terminal
3. Teste avec `/status` pour voir si tout fonctionne
4. Contacte-moi sur Telegram

## 📝 Changelog

### v1.0.0 (Janvier 2025)
- ✅ Monitoring temps réel d'Arii
- ✅ Notifications Telegram
- ✅ Boutons d'action
- ✅ Système de settings
- ✅ Historique des bets
- 🚧 Copie automatique (en développement)

## 🙏 Remerciements

- Arii Defi pour les alpha bets
- Myriad Markets pour la plateforme
- Abstract Chain pour l'infrastructure
- Anthropic Claude pour l'aide au développement

---

**Made with ❤️ for the degen community**

*Disclaimer: This is not financial advice. Trade at your own risk.*