import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, Linking, Alert, Animated, Dimensions, Modal, ScrollView, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import PagerView from 'react-native-pager-view';
import { hapticSelection, hapticLight, hapticMedium, hapticSoft } from './src/utils/animations';
import { findOverlappingSlots, slotKey, tallyVotes } from './src/utils/slotUtils';
import { sendEmail, buildVotingEmail, buildConfirmationEmail, buildTiebreakEmail } from './src/utils/emailService';

export const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

import DashboardScreen from './src/screens/DashboardScreen';
import EventsScreen from './src/screens/EventsScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import LoginScreen from './src/screens/LoginScreen';
import InvitationResponseModal from './src/screens/InvitationResponseModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [invitationData, setInvitationData] = useState(null);

  useEffect(() => {
    loadUser();
    loadDarkMode();
    loadNotifications();

    // Handle deep links for accept/decline
    const handleDeepLink = ({ url }) => processDeepLink(url);
    const sub = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then(url => { if (url) processDeepLink(url); });
    return () => sub.remove();
  }, []);

  const processDeepLink = async (url) => {
    if (!url) return;
    try {
      // Parse all params from deep link
      const paramStr = url.split('?')[1];
      if (!paramStr) return;
      const params = {};
      paramStr.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) params[k] = decodeURIComponent(v);
      });

      // Check if this is a native invitation flow (from email -> respond.html -> app)
      if (url.includes('macromanage://invite')) {
        const { eventId, email, title, host, hostEmail, location, budget, response } = params;
        if (eventId && email) {
          setInvitationData({ eventId, email, title: title || 'Event', host: host || '', hostEmail: hostEmail || '', location: location || '', budget: budget || '', response: response || '' });
          return;
        }
      }

      // Legacy deep link handling (from respond.html completion)
      const { eventId, action, name: friendName, email: friendEmail } = params;
      if (!eventId || !action || !friendName) return;

      // Parse optional availability and friend flag
      let availability = null;
      try { if (params.availability) availability = JSON.parse(params.availability); } catch (e) {}
      const friendAccepted = params.friend === 'yes';

      const eventsData = await AsyncStorage.getItem('macromanage_events');
      if (!eventsData) return;
      const events = JSON.parse(eventsData);
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const notifs = JSON.parse(await AsyncStorage.getItem('notifications') || '[]');

      if (action === 'decline') {
        // Remove the person from the event's friends list
        if (event.friends) {
          event.friends = event.friends.filter(f => {
            const fEmail = (f.contact || f.email || '').toLowerCase();
            const fName = (f.name || '').toLowerCase();
            return fEmail !== (friendEmail || '').toLowerCase() && fName !== friendName.toLowerCase();
          });
        }
        if (!event.responses) event.responses = [];
        const existing = event.responses.find(r => r.name === friendName);
        if (existing) existing.response = 'declined';
        else event.responses.push({ name: friendName, response: 'declined' });

        notifs.unshift({
          id: Date.now().toString(),
          message: `${friendName} declined "${event.title}" and has been removed from the event.`,
          read: false,
          timestamp: new Date().toISOString(),
        });

        await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));
        await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
        reloadNotifications();
        Alert.alert('Response Received', `${friendName} declined "${event.title}" and has been removed.`);

      } else if (action === 'accept') {
        if (!event.responses) event.responses = [];
        const existing = event.responses.find(r => r.name === friendName);
        if (existing) { existing.response = 'accepted'; existing.availability = availability; }
        else event.responses.push({ name: friendName, email: friendEmail, response: 'accepted', availability });

        if (friendAccepted && friendEmail) {
          const friendsData = await AsyncStorage.getItem('all_friends');
          const friends = friendsData ? JSON.parse(friendsData) : [];
          const alreadyFriend = friends.some(f => (f.contact || f.email || '').toLowerCase() === friendEmail.toLowerCase());
          if (!alreadyFriend) {
            friends.push({ name: friendName, contact: friendEmail, addedAt: new Date().toISOString() });
            await AsyncStorage.setItem('all_friends', JSON.stringify(friends));
          }
          notifs.unshift({
            id: (Date.now() + 1).toString(),
            message: `${friendName} added you as a friend!`,
            read: false,
            timestamp: new Date().toISOString(),
          });
        }

        let notifMsg = `${friendName} accepted "${event.title}"`;
        if (availability && Object.keys(availability).length > 0) {
          const dates = Object.keys(availability).join(', ');
          notifMsg += ` and is available on ${dates}`;
        }
        notifs.unshift({
          id: Date.now().toString(),
          message: notifMsg,
          read: false,
          timestamp: new Date().toISOString(),
        });

        const totalInvited = (event.friends || []).length;
        const totalResponses = (event.responses || []).filter(r => r.response === 'accepted' || r.response === 'declined').length;
        if (totalInvited > 0 && totalResponses >= totalInvited && event.status === 'pending') {
          const acceptedResponses = (event.responses || []).filter(r => r.response === 'accepted');
          const overlapping = findOverlappingSlots(acceptedResponses);

          if (overlapping.length === 1) {
            event.status = 'confirmed';
            event.confirmedDate = overlapping[0].date;
            event.confirmedTime = `${overlapping[0].start} - ${overlapping[0].end}`;
          } else if (overlapping.length > 1) {
            event.status = 'voting';
            event.overlappingSlots = overlapping;
            event.timeVotes = {};
            event.votingRound = 1;
          } else if (event.dateSlots && event.dateSlots.length > 0) {
            event.status = 'confirmed';
            event.confirmedDate = event.dateSlots[0].date;
            event.confirmedTime = `${event.dateSlots[0].start} - ${event.dateSlots[0].end}`;
          } else {
            event.status = 'confirmed';
          }
        }

        // Voting notifications + emails
        if (event.status === 'voting' && event.overlappingSlots) {
          notifs.unshift({
            id: (Date.now() + 2).toString(),
            message: `All responses in for "${event.title}"! ${event.overlappingSlots.length} overlapping time slots found. Vote now!`,
            read: false,
            timestamp: new Date().toISOString(),
          });
          const userData = await AsyncStorage.getItem('mm_user');
          const hostUser = userData ? JSON.parse(userData).user : null;
          const hostName = hostUser?.name || 'Host';
          const acceptedPeople = (event.responses || []).filter(r => r.response === 'accepted');
          for (const person of acceptedPeople) {
            const pEmail = person.email || '';
            if (pEmail) {
              const html = buildVotingEmail(event.title, hostName, event.overlappingSlots, event.id, pEmail);
              sendEmail(pEmail, person.name || pEmail, `Vote for a time: ${event.title}`, html);
            }
          }
        }

        // Confirmation notifications + emails
        if (event.status === 'confirmed' && event.confirmedDate) {
          notifs.unshift({
            id: (Date.now() + 3).toString(),
            message: `"${event.title}" is confirmed for ${event.confirmedDate}${event.confirmedTime ? ` at ${event.confirmedTime}` : ''}!`,
            read: false,
            timestamp: new Date().toISOString(),
          });
          const userData2 = await AsyncStorage.getItem('mm_user');
          const hostUser2 = userData2 ? JSON.parse(userData2).user : null;
          const hostName2 = hostUser2?.name || 'Host';
          for (const f of (event.friends || [])) {
            const fEmail = f.contact || f.email || '';
            if (fEmail) {
              const html = buildConfirmationEmail(event.title, hostName2, event.confirmedDate, event.confirmedTime || '', event.location || '');
              sendEmail(fEmail, f.name || fEmail, `Confirmed: ${event.title}`, html);
            }
          }
        }

        await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));
        await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
        reloadNotifications();
        Alert.alert('Response Received', `${friendName} accepted "${event.title}"!`);

      // --- Handle vote deep link ---
      } else if (action === 'vote' || params.slot) {
        const voteSlotKey = params.slot;
        const voterName = friendName || params.name || 'Someone';
        const voterEmail = friendEmail || params.email || '';
        if (!voteSlotKey) return;

        if (!event.timeVotes) event.timeVotes = {};
        if (!event.timeVotes[voteSlotKey]) event.timeVotes[voteSlotKey] = [];
        const alreadyVoted = event.timeVotes[voteSlotKey].some(v => v === voterName || v === voterEmail);
        // Remove previous vote from this person
        Object.keys(event.timeVotes).forEach(key => {
          event.timeVotes[key] = event.timeVotes[key].filter(v => v !== voterName && v !== voterEmail);
        });
        event.timeVotes[voteSlotKey].push(voterName);

        notifs.unshift({
          id: Date.now().toString(),
          message: `${voterName} voted for a time slot on "${event.title}"`,
          read: false,
          timestamp: new Date().toISOString(),
        });

        // Check if everyone has voted
        const allVoters = new Set();
        Object.values(event.timeVotes).forEach(voters => voters.forEach(v => allVoters.add(v)));
        const acceptedCount = (event.responses || []).filter(r => r.response === 'accepted').length;

        if (allVoters.size >= acceptedCount && event.status === 'voting') {
          const { winner, isTie, tiedSlots, tallies } = tallyVotes(event.timeVotes, event.overlappingSlots);
          if (winner) {
            event.status = 'confirmed';
            event.confirmedDate = winner.date;
            event.confirmedTime = `${winner.start} - ${winner.end}`;
            notifs.unshift({
              id: (Date.now() + 4).toString(),
              message: `"${event.title}" is confirmed for ${winner.date} at ${winner.start} - ${winner.end}!`,
              read: false,
              timestamp: new Date().toISOString(),
            });
            const userData3 = await AsyncStorage.getItem('mm_user');
            const hostUser3 = userData3 ? JSON.parse(userData3).user : null;
            for (const f of (event.friends || [])) {
              const fEmail = f.contact || f.email || '';
              if (fEmail) {
                const html = buildConfirmationEmail(event.title, hostUser3?.name || 'Host', winner.date, `${winner.start} - ${winner.end}`, event.location || '');
                sendEmail(fEmail, f.name || fEmail, `Confirmed: ${event.title}`, html);
              }
            }
          } else if (isTie) {
            event.overlappingSlots = tiedSlots;
            event.timeVotes = {};
            event.votingRound = (event.votingRound || 1) + 1;
            notifs.unshift({
              id: (Date.now() + 5).toString(),
              message: `Tie on "${event.title}"! Vote again between ${tiedSlots.length} tied slots (Round ${event.votingRound}).`,
              read: false,
              timestamp: new Date().toISOString(),
            });
            const userData4 = await AsyncStorage.getItem('mm_user');
            const hostUser4 = userData4 ? JSON.parse(userData4).user : null;
            const acceptedPeople2 = (event.responses || []).filter(r => r.response === 'accepted');
            for (const person of acceptedPeople2) {
              const pEmail = person.email || '';
              if (pEmail) {
                const html = buildTiebreakEmail(event.title, hostUser4?.name || 'Host', tiedSlots, event.id, pEmail, event.votingRound);
                sendEmail(pEmail, person.name || pEmail, `Tiebreaker vote: ${event.title}`, html);
              }
            }
          }
        }

        await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));
        await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
        reloadNotifications();
        Alert.alert('Vote Recorded', `${voterName}'s vote has been recorded for "${event.title}"`);
      }
    } catch (err) {
      console.log('Deep link error:', err);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('mm_user');
      if (userData) {
        const data = JSON.parse(userData);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDarkMode = async () => {
    try {
      const darkMode = await AsyncStorage.getItem('dark_mode');
      if (darkMode) {
        setIsDarkMode(darkMode === 'true');
      }
    } catch (error) {
      console.error('Error loading dark mode:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifData = await AsyncStorage.getItem('notifications');
      if (notifData) {
        setNotifications(JSON.parse(notifData));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem('dark_mode', newMode.toString());
  };

  const handleLogin = async (name, email) => {
    const newUser = { name, email };
    await AsyncStorage.setItem('mm_user', JSON.stringify({ user: newUser }));
    setUser(newUser);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('mm_user');
    setUser(null);
  };

  const [showNotifications, setShowNotifications] = useState(false);

  const markNotifRead = async (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
  };

  const markAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
  };

  const clearAllNotifs = async () => {
    setNotifications([]);
    await AsyncStorage.setItem('notifications', JSON.stringify([]));
  };

  const pagerRef = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const focusListenersRef = useRef({});
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = screenWidth / 5;

  const colors = {
    light: {
      background: '#FAF3E6',
      card: '#FFF8F0',
      text: '#6B5744',
      textSecondary: '#9A8568',
      primary: '#B08D6B',
      border: '#E8DBC4',
      tabBar: '#FAF3E6',
    },
    dark: {
      background: '#1c1c1e',
      card: '#2c2c2e',
      text: '#e5e5e5',
      textSecondary: '#c4a87a',
      primary: '#C09B74',
      border: '#3a3a3c',
      tabBar: '#1c1c1e',
    }
  };

  const theme = isDarkMode ? colors.dark : colors.light;

  const tabs = [
    { name: 'Dashboard', icon: '📊' },
    { name: 'Events', icon: '📅' },
    { name: 'Create', icon: '➕' },
    { name: 'Friends', icon: '🤝' },
    { name: 'Profile', icon: '👤' },
  ];

  const tabScales = useRef(tabs.map(() => new Animated.Value(1))).current;
  const darkModeScale = useRef(new Animated.Value(1)).current;
  const bellScale = useRef(new Animated.Value(1)).current;
  const notifPanY = useRef(new Animated.Value(0)).current;
  const notifScrollY = useRef(0);
  const screenH = Dimensions.get('window').height;
  const notifPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && notifScrollY.current <= 0,
    onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8 && notifScrollY.current <= 0,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) notifPanY.setValue(gs.dy);
      else notifPanY.setValue(gs.dy * 0.3);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 40 || gs.vy > 0.2) {
        Animated.timing(notifPanY, { toValue: screenH, duration: 200, useNativeDriver: true }).start(() => {
          setShowNotifications(false);
          notifPanY.setValue(0);
        });
      } else {
        Animated.spring(notifPanY, { toValue: 0, tension: 180, friction: 12, useNativeDriver: true }).start();
      }
    },
  })).current;

  const bounceDarkMode = () => {
    hapticMedium();
    Animated.sequence([
      Animated.spring(darkModeScale, { toValue: 1.35, tension: 400, friction: 4, useNativeDriver: true }),
      Animated.spring(darkModeScale, { toValue: 0.92, tension: 350, friction: 5, useNativeDriver: true }),
      Animated.spring(darkModeScale, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }),
    ]).start();
    toggleDarkMode();
  };

  const bounceBell = () => {
    hapticMedium();
    reloadNotifications();
    notifPanY.setValue(0);
    Animated.sequence([
      Animated.spring(bellScale, { toValue: 1.45, tension: 500, friction: 3, useNativeDriver: true }),
      Animated.spring(bellScale, { toValue: 0.85, tension: 400, friction: 4, useNativeDriver: true }),
      Animated.spring(bellScale, { toValue: 1.08, tension: 300, friction: 5, useNativeDriver: true }),
      Animated.spring(bellScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    setShowNotifications(true);
  };

  const reloadNotifications = async () => {
    try {
      const notifData = await AsyncStorage.getItem('notifications');
      if (notifData) setNotifications(JSON.parse(notifData));
    } catch (e) {}
  };

  const goToTab = (index) => {
    hapticLight();
    pagerRef.current?.setPage(index);
    setActiveTab(index);
    // Snappy double-bounce on tab tap
    Animated.sequence([
      Animated.spring(tabScales[index], { toValue: 1.3, tension: 420, friction: 4, useNativeDriver: true }),
      Animated.spring(tabScales[index], { toValue: 0.93, tension: 380, friction: 5, useNativeDriver: true }),
      Animated.spring(tabScales[index], { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const createNavigation = (tabName) => ({
    navigate: (name) => {
      const idx = tabs.findIndex(t => t.name === name);
      if (idx >= 0) goToTab(idx);
    },
    addListener: (event, callback) => {
      if (event === 'focus') {
        if (!focusListenersRef.current[tabName]) focusListenersRef.current[tabName] = [];
        focusListenersRef.current[tabName].push(callback);
        return () => {
          focusListenersRef.current[tabName] = focusListenersRef.current[tabName].filter(cb => cb !== callback);
        };
      }
      return () => {};
    },
  });

  const dashboardNav = React.useMemo(() => createNavigation('Dashboard'), []);
  const eventsNav = React.useMemo(() => createNavigation('Events'), []);
  const createNav = React.useMemo(() => createNavigation('Create'), []);
  const friendsNav = React.useMemo(() => createNavigation('Friends'), []);
  const profileNav = React.useMemo(() => createNavigation('Profile'), []);

  const onPageScroll = (e) => {
    const { position, offset } = e.nativeEvent;
    // Move indicator in real-time as user drags between pages
    tabIndicatorX.setValue((position + offset) * tabWidth);
  };

  const onPageSelected = (e) => {
    const idx = e.nativeEvent.position;
    setActiveTab(idx);
    // Snap indicator cleanly after swipe settles
    tabIndicatorX.setValue(idx * tabWidth);
    reloadNotifications();
    const tabName = tabs[idx].name;
    const listeners = focusListenersRef.current[tabName] || [];
    listeners.forEach(cb => cb());
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, theme, notifications, setNotifications, reloadNotifications }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.tabBar }}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />

        {/* Header */}
        <View style={[appStyles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[appStyles.headerTitle, { color: theme.text }]}>{tabs[activeTab].name}</Text>
          <View style={appStyles.headerRight}>
            <TouchableOpacity onPress={bounceDarkMode} activeOpacity={0.7}>
              <Animated.Text style={{ fontSize: 24, transform: [{ scale: darkModeScale }] }}>{isDarkMode ? '☀️' : '🌙'}</Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={bounceBell} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: bellScale }] }}>
                <Text style={{ fontSize: 24 }}>🔔</Text>
                {notifications.filter(n => !n.read).length > 0 && (
                  <View style={appStyles.badge}>
                    <Text style={appStyles.badgeText}>
                      {notifications.filter(n => !n.read).length}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Swipeable Pages */}
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
        >
          <View key="0"><DashboardScreen navigation={dashboardNav} /></View>
          <View key="1"><EventsScreen navigation={eventsNav} /></View>
          <View key="2"><CreateEventScreen navigation={createNav} /></View>
          <View key="3"><FriendsScreen navigation={friendsNav} /></View>
          <View key="4"><ProfileScreen navigation={profileNav} user={user} onLogout={handleLogout} /></View>
        </PagerView>

        {/* Custom Bottom Tab Bar */}
        <View style={[appStyles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
          <Animated.View style={[appStyles.tabIndicator, {
            backgroundColor: theme.primary,
            width: tabWidth * 0.5,
            transform: [{ translateX: Animated.add(tabIndicatorX, tabWidth * 0.25) }],
          }]} />
          {tabs.map((tab, idx) => (
            <TouchableOpacity
              key={tab.name}
              style={appStyles.tabItem}
              onPress={() => goToTab(idx)}
              activeOpacity={0.7}
            >
              <Animated.Text style={[
                appStyles.tabLabel,
                { color: activeTab === idx ? theme.primary : theme.textSecondary,
                  fontWeight: activeTab === idx ? '700' : '500',
                  transform: [{ scale: tabScales[idx] }] }
              ]}>
                {tab.name}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invitation Response Modal */}
        <InvitationResponseModal
          visible={!!invitationData}
          invitation={invitationData}
          theme={theme}
          isDarkMode={isDarkMode}
          onComplete={() => {
            setInvitationData(null);
            reloadNotifications();
            // Navigate to Events tab to see the updated event
            goToTab(1);
          }}
          onDismiss={() => setInvitationData(null)}
        />

        {/* Notification Modal - Full Page with swipe-down dismiss */}
        <Modal visible={showNotifications} animationType="slide" transparent>
          <Animated.View {...notifPanResponder.panHandlers} style={[appStyles.notifFullPage, { backgroundColor: theme.background, transform: [{ translateY: notifPanY }] }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={appStyles.notifSwipeZone}>
                <View style={appStyles.notifSwipeBar} />
              </View>
              <View style={appStyles.notifHeader}>
                <Text style={[appStyles.notifTitle, { color: theme.text }]}>Notifications</Text>
                <TouchableOpacity onPress={() => setShowNotifications(false)}>
                  <Text style={{ fontSize: 16, color: theme.primary, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>

              {notifications.length > 0 && (
                <View style={appStyles.notifActions}>
                  <TouchableOpacity onPress={markAllRead} style={[appStyles.notifActionBtn, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f0ebe0' }]}>
                    <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '600' }}>Mark All Read</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearAllNotifs} style={[appStyles.notifActionBtn, { backgroundColor: isDarkMode ? '#3a1a1a' : '#fef2f2' }]}>
                    <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '600' }}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 40 }}
                onScroll={(e) => { notifScrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {notifications.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: theme.text }}>No notifications</Text>
                    <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>You're all caught up!</Text>
                  </View>
                ) : (
                  notifications.map((notif, idx) => (
                    <TouchableOpacity
                      key={notif.id || idx}
                      style={[
                        appStyles.notifItem,
                        { backgroundColor: notif.read ? 'transparent' : (isDarkMode ? '#3a351a' : '#fffbeb'), borderBottomColor: theme.border }
                      ]}
                      onPress={() => markNotifRead(notif.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        {!notif.read && <View style={appStyles.notifDot} />}
                        <View style={{ flex: 1, marginLeft: notif.read ? 14 : 0 }}>
                          <Text style={[appStyles.notifMessage, { color: theme.text, fontWeight: notif.read ? '400' : '600' }]}>
                            {notif.message}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                            {(() => {
                              try {
                                const d = new Date(notif.timestamp);
                                const now = new Date();
                                const diffMin = Math.floor((now - d) / 60000);
                                if (diffMin < 1) return 'Just now';
                                if (diffMin < 60) return `${diffMin}m ago`;
                                const diffHr = Math.floor(diffMin / 60);
                                if (diffHr < 24) return `${diffHr}h ago`;
                                const diffDay = Math.floor(diffHr / 24);
                                if (diffDay < 7) return `${diffDay}d ago`;
                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              } catch { return ''; }
                            })()}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Modal>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

const appStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    paddingTop: 10,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    borderRadius: 1.5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Notification modal - full page
  notifFullPage: {
    flex: 1,
    paddingHorizontal: 24,
  },
  notifSwipeZone: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
  },
  notifSwipeBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  notifActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  notifActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  notifItem: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginTop: 5,
    marginRight: 6,
  },
  notifMessage: {
    fontSize: 15,
    lineHeight: 20,
  },
});
