import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../App';
import { hapticLight, hapticSuccess } from '../utils/animations';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function SpringCard({ children, style, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 40, friction: 7, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = () => {
    hapticLight();
    Animated.spring(scale, { toValue: 0.94, tension: 400, friction: 8, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 250, friction: 6, useNativeDriver: true }).start();
  };

  return (
    <AnimatedTouchable
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { opacity: entrance, transform: [{ scale }, { translateY: slideUp }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

const prettyDate = (dateStr) => {
  if (!dateStr) return 'No date';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
};

const prettyTimestamp = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

export default function DashboardScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeSlide = useRef(new Animated.Value(20)).current;
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState({
    confirmedRate: 0,
    weeklyEvents: 0,
    mostCommonTime: 'N/A'
  });

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(welcomeSlide, { toValue: 0, tension: 35, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { loadData(); });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const userData = await AsyncStorage.getItem('mm_user');
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      const notifData = await AsyncStorage.getItem('notifications');
      
      if (userData) {
        const data = JSON.parse(userData);
        setUser(data.user);
      }
      
      const loadedEvents = eventsData ? JSON.parse(eventsData) : [];
      setEvents(loadedEvents);
      setNotifications(notifData ? JSON.parse(notifData) : []);
      
      // Calculate insights
      calculateInsights(loadedEvents);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const calculateInsights = (events) => {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weeklyEvents = events.filter(e => {
      if (!e.dates || !e.dates[0]) return false;
      const eventDate = new Date(e.dates[0]);
      return eventDate >= weekStart && eventDate < weekEnd;
    }).length;
    
    const confirmedRate = events.length > 0 
      ? Math.round((events.filter(e => e.status === 'confirmed').length / events.length) * 100)
      : 0;
    
    // Find most common time
    const times = {};
    events.forEach(e => {
      if (e.times && e.times[0] && e.times[0].start) {
        const hour = e.times[0].start.split(':')[0];
        times[hour] = (times[hour] || 0) + 1;
      }
    });
    
    const mostCommonHour = Object.keys(times).length > 0
      ? Object.keys(times).reduce((a, b) => times[a] > times[b] ? a : b)
      : null;
    
    let mostCommonTime = 'N/A';
    if (mostCommonHour) {
      const h = parseInt(mostCommonHour);
      if (isNaN(h)) mostCommonTime = 'N/A';
      else if (h === 0) mostCommonTime = '12 AM';
      else if (h < 12) mostCommonTime = `${h} AM`;
      else if (h === 12) mostCommonTime = '12 PM';
      else mostCommonTime = `${h - 12} PM`;
    }
    
    setInsights({ confirmedRate, weeklyEvents, mostCommonTime });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const confirmedEvents = events.filter(e => e.status === 'confirmed');
  const pendingEvents = events.filter(e => e.status === 'pending');
  const unreadNotifs = notifications.filter(n => !n.read);
  const recentEvents = events.slice(0, 5);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Animated.View style={[styles.welcomeSection, { opacity: fadeAnim, transform: [{ translateY: welcomeSlide }] }]}>
        <Text style={[styles.welcomeText, { color: theme.text }]}>
          Welcome back, {user?.name || 'User'}!
        </Text>
      </Animated.View>

      {/* Main Stats Grid - 4 cards */}
      <View style={styles.statsGrid}>
        <SpringCard style={[styles.statCard, { backgroundColor: theme.card }]} delay={60}>
          <Text style={[styles.statNumber, { color: theme.text }]}>{events.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Events</Text>
        </SpringCard>
        
        <SpringCard style={[styles.statCard, { backgroundColor: theme.card }]} delay={120}>
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{confirmedEvents.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Confirmed</Text>
        </SpringCard>
        
        <SpringCard style={[styles.statCard, { backgroundColor: theme.card }]} delay={180}>
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{pendingEvents.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
        </SpringCard>
        
        <SpringCard style={[styles.statCard, { backgroundColor: isDarkMode ? '#3a1a1a' : '#FFEBEE' }]} delay={240}>
          <Text style={[styles.statNumber, { color: '#EF4444' }]}>{unreadNotifs.length}</Text>
          <Text style={[styles.statLabel, { color: '#EF4444', fontWeight: '600' }]}>Alerts</Text>
        </SpringCard>
      </View>

      {/* Insights Row - 3 cards */}
      <View style={styles.insightsGrid}>
        <SpringCard style={[styles.insightCard, { backgroundColor: theme.card }]} delay={300}>
          <Text style={[styles.insightNumber, { color: '#10B981' }]} numberOfLines={1} adjustsFontSizeToFit>{insights.confirmedRate}%</Text>
          <Text style={[styles.insightLabel, { color: theme.textSecondary }]}>Confirmed Rate</Text>
        </SpringCard>
        
        <SpringCard style={[styles.insightCard, { backgroundColor: theme.card }]} delay={360}>
          <Text style={[styles.insightNumber, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>{insights.weeklyEvents}</Text>
          <Text style={[styles.insightLabel, { color: theme.textSecondary }]}>This Week</Text>
        </SpringCard>
        
        <SpringCard style={[styles.insightCard, { backgroundColor: theme.card }]} delay={420}>
          <Text style={[styles.insightNumber, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{insights.mostCommonTime}</Text>
          <Text style={[styles.insightLabel, { color: theme.textSecondary }]}>Common Time</Text>
        </SpringCard>
      </View>

      {/* Two Column Layout */}
      <View style={styles.twoColumnSection}>
        {/* Recent Events */}
        <SpringCard style={[styles.columnCard, { backgroundColor: theme.card }]} delay={480}>
          <Text style={[styles.columnTitle, { color: theme.text }]}>Recent Events</Text>
          {recentEvents.length > 0 ? (
            recentEvents.map((event, idx) => (
              <View key={idx} style={[styles.eventRow, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventRowTitle, { color: theme.text }]}>{event.title}</Text>
                  <Text style={[styles.eventRowDate, { color: theme.textSecondary }]}>
                    {prettyDate(event.dates?.[0])}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: event.status === 'confirmed' 
                    ? (isDarkMode ? '#1a3a1a' : '#E8F5E9')
                    : (isDarkMode ? '#3a3a1a' : '#FFF9C4')
                  }
                ]}>
                  <Text style={{
                    fontSize: 11,
                    color: event.status === 'confirmed' ? '#10B981' : '#F59E0B',
                    fontWeight: '600'
                  }}>
                    {event.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No events yet</Text>
          )}
        </SpringCard>

        {/* Activity Feed */}
        <SpringCard style={[styles.columnCard, { backgroundColor: theme.card }]} delay={540}>
          <Text style={[styles.columnTitle, { color: theme.text }]}>Activity Feed</Text>
          {unreadNotifs.length > 0 ? (
            unreadNotifs.slice(0, 5).map((notif, idx) => (
              <View key={idx} style={[styles.activityRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.activityMessage, { color: theme.text }]}>{notif.message}</Text>
                <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                  {prettyTimestamp(notif.timestamp)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No recent activity</Text>
          )}
        </SpringCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    paddingTop: 16,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  statNumber: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  insightsGrid: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  insightCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  insightNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  twoColumnSection: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 16,
  },
  columnCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventRowDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 14,
  },
});
