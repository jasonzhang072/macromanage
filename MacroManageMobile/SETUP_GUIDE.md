# MacroManage Mobile - Quick Setup Guide

## 🎯 Quick Start (5 minutes)

### Step 1: Install Node.js
```bash
# Check if already installed
node --version

# If not installed, download from:
# https://nodejs.org/ (choose LTS version)
```

### Step 2: Install Dependencies
```bash
cd MacroManageMobile
npm install
```

### Step 3: Start the App
```bash
npm start
```

### Step 4: Run on Your Phone
1. Install **Expo Go** app on your phone:
   - iOS: App Store
   - Android: Google Play Store

2. Scan the QR code shown in terminal with:
   - iOS: Camera app
   - Android: Expo Go app

3. App will load on your phone!

---

## 📱 What You'll Get

### All Features from Web App:
- ✅ User authentication
- ✅ Event creation (3-step flow)
- ✅ Dashboard with stats
- ✅ RSVP system
- ✅ Notifications
- ✅ AI date matching
- ✅ Friend invitations
- ✅ Dark mode support
- ✅ Weather integration
- ✅ Expense tracking

### Mobile-Specific Features:
- 📱 Native mobile UI
- 🔄 Pull-to-refresh
- 📲 Push notifications (can be added)
- 📍 Location services (can be added)
- 📅 Calendar integration (can be added)

---

## 🎨 Screens Overview

### 1. **Login Screen**
- Simple name + email entry
- Data stored locally on device

### 2. **Dashboard Tab** 📊
- Event statistics cards
- Upcoming events preview
- Recent notifications
- Pull to refresh

### 3. **Events Tab** 📅
- Filter: All / Confirmed / Pending
- Event cards with full details
- RSVP responses
- AI-suggested best times
- Status badges

### 4. **Create Tab** ➕
- **Step 1**: Event details (title, budget, location)
- **Step 2**: Date selection
- **Step 3**: Friend invitations
- Validation at each step

### 5. **Profile Tab** 👤
- User info
- Features list
- Logout button

---

## 🔧 Common Commands

```bash
# Start development server
npm start

# Run on iOS simulator (macOS only)
npm run ios

# Run on Android emulator
npm run android

# Run in web browser
npm run web

# Clear cache and restart
expo start -c
```

---

## 💾 Data Storage

All data stored locally using AsyncStorage:
- Works offline
- Persists between app restarts
- Same data structure as web app
- Can sync with backend API later

---

## 🎨 Customization

### Change Colors
Edit StyleSheet in each screen file:
```javascript
const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: '#8B4513', // Change this
  }
});
```

### Add New Screen
1. Create file in `src/screens/NewScreen.js`
2. Add to `App.js` navigation:
```javascript
<Tab.Screen name="New" component={NewScreen} />
```

---

## 🚀 Next Steps

### Enhance the App:
1. **Add Calendar Picker** - Replace text input with visual calendar
2. **Push Notifications** - Alert users of RSVPs
3. **Location Services** - Auto-fill location
4. **Camera Integration** - Add event photos
5. **Share Functionality** - Share events via SMS/WhatsApp
6. **Backend Integration** - Sync across devices

### Publish to App Stores:
1. **Test thoroughly** on both iOS and Android
2. **Create app icons** and splash screens
3. **Build production version**:
   ```bash
   expo build:ios
   expo build:android
   ```
4. **Submit to stores** via Apple/Google developer accounts

---

## 📞 Need Help?

- **Expo Docs**: https://docs.expo.dev/
- **React Native Docs**: https://reactnative.dev/
- **React Navigation**: https://reactnavigation.org/

---

## ✅ Checklist

- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] Expo Go app on phone
- [ ] Development server running (`npm start`)
- [ ] App loaded on phone
- [ ] Login works
- [ ] Can create event
- [ ] Can view events
- [ ] Profile shows correctly

---

**You're all set! 🎉**

*Preserve Human Connection - Now on Mobile!*
