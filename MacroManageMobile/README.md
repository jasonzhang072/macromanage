# MacroManage Mobile - React Native App

A mobile version of MacroManage built with React Native and Expo.

## 🚀 Features

- ✅ **User Authentication** - Login/Signup with local storage
- 📊 **Dashboard** - Overview of events, notifications, and stats
- 📅 **Event Management** - Create, view, and manage events
- 🔔 **Notifications** - Real-time alerts for RSVPs
- 🎯 **AI Date Matching** - Smart scheduling based on availability
- 👥 **Friend Invitations** - Invite friends via email
- 🌤️ **Weather Integration** - Weather data for event planning
- 💰 **Expense Splitting** - Budget tracking
- 🚗 **Carpool Coordination** - Organize transportation

## 📱 Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform
- **React Navigation** - Navigation library
- **AsyncStorage** - Local data persistence
- **Axios** - HTTP requests

## 🛠️ Setup Instructions

### Prerequisites

1. **Install Node.js** (v18 or higher)
   ```bash
   # Download from https://nodejs.org/
   # Or use Homebrew on macOS:
   brew install node
   ```

2. **Install Expo CLI**
   ```bash
   npm install -g expo-cli
   ```

3. **Install Expo Go App** on your phone
   - iOS: Download from App Store
   - Android: Download from Google Play Store

### Installation

1. **Navigate to the project directory**
   ```bash
   cd MacroManageMobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

4. **Run on your device**
   - Scan the QR code with your phone camera (iOS) or Expo Go app (Android)
   - The app will load on your device

### Alternative: Run on Simulator/Emulator

**iOS Simulator (macOS only):**
```bash
npm run ios
```

**Android Emulator:**
```bash
npm run android
```

## 📂 Project Structure

```
MacroManageMobile/
├── App.js                      # Main app entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
├── src/
│   └── screens/
│       ├── LoginScreen.js      # Login/Signup screen
│       ├── DashboardScreen.js  # Dashboard with stats
│       ├── EventsScreen.js     # Events list and details
│       ├── CreateEventScreen.js # Event creation flow
│       └── ProfileScreen.js    # User profile and settings
└── assets/                     # Images and icons
```

## 🎨 Color Scheme

- **Primary Brown**: `#8B4513`
- **Dark Brown**: `#654321`
- **Beige Background**: `#FDF6E9`
- **Light Beige**: `#E5D5B7`
- **Success Green**: `#10B981`
- **Warning Yellow**: `#F59E0B`
- **Error Red**: `#EF4444`

## 📱 Screens

### 1. Login Screen
- Name and email input
- Local authentication
- Data stored in AsyncStorage

### 2. Dashboard
- Event statistics (total, upcoming, pending)
- Notification alerts
- Quick overview of upcoming events
- Pull-to-refresh functionality

### 3. Events Screen
- Filter by status (All, Confirmed, Pending)
- View event details
- See RSVPs and responses
- AI-suggested best times
- Pull-to-refresh

### 4. Create Event Screen
- **Step 1**: Event details (title, budget, location)
- **Step 2**: Date selection
- **Step 3**: Invite friends
- Multi-step form with validation

### 5. Profile Screen
- User information
- App features list
- Logout functionality

## 🔄 Data Persistence

All data is stored locally using AsyncStorage:
- `mm_user` - User account data
- `macromanage_events` - Events list
- `notifications` - Notification history

## 🚀 Building for Production

### iOS (requires macOS and Apple Developer account)
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

### Web (bonus)
```bash
npm run web
```

## 🔧 Customization

### Modify Colors
Edit the color values in each screen's StyleSheet to match your brand.

### Add Features
1. Create new screen in `src/screens/`
2. Add to navigation in `App.js`
3. Update tab bar configuration

### API Integration
Replace local storage with API calls:
```javascript
// Example in EventsScreen.js
const response = await fetch('https://your-api.com/events');
const events = await response.json();
```

## 📝 Development Tips

1. **Hot Reload**: Changes auto-reload on save
2. **Debug Menu**: Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
3. **Console Logs**: View in terminal where `expo start` is running
4. **Remote Debugging**: Enable in debug menu

## 🐛 Troubleshooting

**Metro bundler issues:**
```bash
expo start -c  # Clear cache
```

**Dependency issues:**
```bash
rm -rf node_modules
npm install
```

**iOS build issues:**
```bash
cd ios && pod install && cd ..
```

## 📦 Publishing

1. **Create Expo account**: https://expo.dev/signup
2. **Login**: `expo login`
3. **Publish**: `expo publish`
4. **Share**: Send the published link to users

## 🔗 Related

- **Web Version**: See parent directory for web app
- **API Backend**: Can be integrated with existing backend
- **Documentation**: https://docs.expo.dev/

## 📄 License

Same as parent MacroManage project

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

---

**Built with ❤️ using React Native & Expo**

*Preserve Human Connection*
