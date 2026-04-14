import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, Alert, Animated, Modal, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../../App';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '../utils/animations';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const toBase64 = (str) => {
  if (typeof btoa === 'function') return btoa(str);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i), b = str.charCodeAt(i+1), c = str.charCodeAt(i+2);
    const bits = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += chars[(bits >> 18) & 63] + chars[(bits >> 12) & 63];
    out += i+1 < str.length ? chars[(bits >> 6) & 63] : '=';
    out += i+2 < str.length ? chars[bits & 63] : '=';
  }
  return out;
};

const hours = Array.from({ length: 12 }, (_, i) => i + 1);
const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const periods = ['AM', 'PM'];

function WheelColumn({ data, selected, onSelect, theme, isDarkMode, width }) {
  const flatListRef = useRef(null);
  const lastSelected = useRef(selected);

  const initialIndex = Math.max(data.indexOf(selected), 0);

  const handleScrollEnd = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    const item = data[clampedIndex];
    if (item !== undefined && item !== lastSelected.current) {
      lastSelected.current = item;
      hapticSelection();
      onSelect(item);
    }
  };

  const renderItem = useCallback(({ item }) => {
    const isSelected = item === selected;
    const label = typeof item === 'number' && item < 10 && data.length > 2
      ? item.toString().padStart(2, '0')
      : item.toString();
    return (
      <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', width }}>
        <Text style={{
          fontSize: isSelected ? 22 : 17,
          fontWeight: isSelected ? '700' : '400',
          color: isSelected ? theme.text : (isDarkMode ? '#666' : '#bbb'),
        }}>{label}</Text>
      </View>
    );
  }, [selected, theme.text, isDarkMode, width, data.length]);

  return (
    <View style={{ height: WHEEL_HEIGHT, width, overflow: 'hidden' }}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.toString()}
        extraData={selected}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={initialIndex}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      />
      <View pointerEvents="none" style={{
        position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0, height: ITEM_HEIGHT,
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDarkMode ? '#555' : '#ddd',
      }} />
    </View>
  );
}

function TimePickerModal({ visible, onClose, startValue, endValue, onChangeBoth, theme, isDarkMode }) {
  const parseTime = (timeStr) => {
    if (!timeStr || timeStr.includes('__')) return { hour: 12, minute: 0, period: 'PM' };
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) return { hour: parseInt(match[1]), minute: parseInt(match[2]), period: match[3].toUpperCase() };
    return { hour: 12, minute: 0, period: 'PM' };
  };

  const s = parseTime(startValue);
  const e = parseTime(endValue);

  const [sHour, setSHour] = useState(s.hour);
  const [sMin, setSMin] = useState(s.minute);
  const [sPer, setSPer] = useState(s.period);
  const [eHour, setEHour] = useState(e.hour);
  const [eMin, setEMin] = useState(e.minute);
  const [ePer, setEPer] = useState(e.period);

  // Sync state when props change (e.g. opening picker for a different time slot)
  React.useEffect(() => {
    const ns = parseTime(startValue);
    const ne = parseTime(endValue);
    setSHour(ns.hour); setSMin(ns.minute); setSPer(ns.period);
    setEHour(ne.hour); setEMin(ne.minute); setEPer(ne.period);
  }, [startValue, endValue]);

  const fmt = (h, m, p) => `${h}:${m.toString().padStart(2, '0')} ${p}`;

  const handleDone = () => {
    hapticMedium();
    onChangeBoth(fmt(sHour, sMin, sPer), fmt(eHour, eMin, ePer));
    onClose();
  };

  const bg = isDarkMode ? '#2a2a2a' : '#fff';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={pickerStyles.overlay}>
        <View style={[pickerStyles.container, { backgroundColor: bg }]}>
          <Text style={[pickerStyles.title, { color: theme.text }]}>Set Time</Text>

          <Text style={[pickerStyles.sectionLabel, { color: theme.textSecondary }]}>Start Time</Text>
          <View style={pickerStyles.wheelRow}>
            <WheelColumn data={hours} selected={sHour} onSelect={setSHour} theme={theme} isDarkMode={isDarkMode} width={70} />
            <Text style={[pickerStyles.colon, { color: theme.text }]}>:</Text>
            <WheelColumn data={minutes} selected={sMin} onSelect={setSMin} theme={theme} isDarkMode={isDarkMode} width={70} />
            <WheelColumn data={periods} selected={sPer} onSelect={setSPer} theme={theme} isDarkMode={isDarkMode} width={60} />
          </View>

          <Text style={[pickerStyles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>End Time</Text>
          <View style={pickerStyles.wheelRow}>
            <WheelColumn data={hours} selected={eHour} onSelect={setEHour} theme={theme} isDarkMode={isDarkMode} width={70} />
            <Text style={[pickerStyles.colon, { color: theme.text }]}>:</Text>
            <WheelColumn data={minutes} selected={eMin} onSelect={setEMin} theme={theme} isDarkMode={isDarkMode} width={70} />
            <WheelColumn data={periods} selected={ePer} onSelect={setEPer} theme={theme} isDarkMode={isDarkMode} width={60} />
          </View>

          <View style={pickerStyles.buttonRow}>
            <TouchableOpacity style={[pickerStyles.cancelBtn, { backgroundColor: isDarkMode ? '#3a3a3a' : '#eee' }]} onPress={onClose} activeOpacity={0.8}>
              <Text style={[pickerStyles.cancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pickerStyles.doneBtn, { backgroundColor: theme.primary }]} onPress={handleDone} activeOpacity={0.8}>
              <Text style={pickerStyles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { fontSize: 24, fontWeight: '700', marginHorizontal: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 30, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  doneBtn: { flex: 1, padding: 16, borderRadius: 30, alignItems: 'center' },
  doneText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default function CreateEventScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [step, setStep] = useState(1);
  const [eventData, setEventData] = useState({
    title: '',
    budget: '',
    location: '',
    eventType: 'single',
    pollOptions: [],
    dates: [],
    dateTimeSlots: {},
    friends: [],
  });

  const [friendEmail, setFriendEmail] = useState('');
  const [friendName, setFriendName] = useState('');
  const [timePickerSlot, setTimePickerSlot] = useState(null);
  const [savedFriends, setSavedFriends] = useState([]);
  const [savedGroups, setSavedGroups] = useState([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [selectedLocationCoords, setSelectedLocationCoords] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState([]);
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const [geocodeTimer, setGeocodeTimer] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const scrollRef = useRef(null);
  const nextBtnScale = useRef(new Animated.Value(1)).current;
  const backBtnScale = useRef(new Animated.Value(1)).current;
  const createBtnScale = useRef(new Animated.Value(1)).current;
  const addFriendBtnScale = useRef(new Animated.Value(1)).current;

  const bounceScale = (animVal, cb) => {
    Animated.sequence([
      Animated.spring(animVal, { toValue: 0.92, tension: 300, friction: 5, useNativeDriver: true }),
      Animated.spring(animVal, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start(() => cb && cb());
  };

  React.useEffect(() => {
    stepFade.setValue(0);
    stepSlide.setValue(30);
    Animated.parallel([
      Animated.timing(stepFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(stepSlide, { toValue: 0, tension: 80, friction: 7, useNativeDriver: true }),
    ]).start();
    hapticMedium();
  }, [step]);

  const loadSavedFriends = useCallback(async () => {
    try {
      const f = await AsyncStorage.getItem('all_friends');
      setSavedFriends(f ? JSON.parse(f) : []);
      const g = await AsyncStorage.getItem('friend_groups');
      setSavedGroups(g ? JSON.parse(g) : []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadSavedFriends();
  }, []);

  useEffect(() => {
    if (!navigation) return;
    const unsub = navigation.addListener('focus', loadSavedFriends);
    return typeof unsub === 'function' ? unsub : undefined;
  }, [navigation, loadSavedFriends]);

  const handleLocationChange = (query) => {
    setEventData({ ...eventData, location: query });
    if (geocodeTimer) clearTimeout(geocodeTimer);
    if (query.length > 3) {
      const timer = setTimeout(() => geocodeAddress(query), 800);
      setGeocodeTimer(timer);
    } else {
      setSelectedLocationCoords(null);
    }
  };

  const geocodeAddress = async (address) => {
    setIsGeocoding(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to show the map.');
        setIsGeocoding(false);
        return;
      }
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        const coords = { latitude, longitude };
        setSelectedLocationCoords(coords);
        setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        hapticSuccess();
        fetchWeather(coords);
      } else {
        setSelectedLocationCoords(null);
      }
    } catch (error) {
      console.log('Geocoding error:', error);
    }
    setIsGeocoding(false);
  };

  const [forecast, setForecast] = useState({});
  const [hourlyForecast, setHourlyForecast] = useState({});

  const wmoToWeather = (code) => {
    if (code == null || code === undefined) return { icon: '🌤️', condition: 'Fair' };
    const c = Number(code);
    if (c === 0) return { icon: '☀️', condition: 'Clear' };
    if (c === 1) return { icon: '🌤️', condition: 'Mostly Clear' };
    if (c === 2) return { icon: '⛅', condition: 'Partly Cloudy' };
    if (c === 3) return { icon: '☁️', condition: 'Overcast' };
    if (c >= 45 && c <= 48) return { icon: '🌫️', condition: 'Foggy' };
    if (c >= 51 && c <= 55) return { icon: '🌦️', condition: 'Drizzle' };
    if (c >= 56 && c <= 57) return { icon: '🌧️', condition: 'Freezing Drizzle' };
    if (c >= 61 && c <= 65) return { icon: '🌧️', condition: 'Rainy' };
    if (c >= 66 && c <= 67) return { icon: '🌧️', condition: 'Freezing Rain' };
    if (c >= 71 && c <= 77) return { icon: '🌨️', condition: 'Snow' };
    if (c >= 80 && c <= 82) return { icon: '🌧️', condition: 'Showers' };
    if (c >= 85 && c <= 86) return { icon: '🌨️', condition: 'Snow Showers' };
    if (c >= 95) return { icon: '⛈️', condition: 'Thunderstorm' };
    return { icon: '🌤️', condition: 'Fair' };
  };

  const fetchWeather = async (coords) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.daily) {
        const days = data.daily.time;
        const highs = data.daily.temperature_2m_max;
        const lows = data.daily.temperature_2m_min;
        const codes = data.daily.weather_code;
        const forecastMap = {};
        days.forEach((d, i) => {
          const w = wmoToWeather(codes[i]);
          const avgTemp = Math.round((highs[i] + lows[i]) / 2);
          forecastMap[d] = { icon: w.icon, temp: avgTemp, condition: w.condition };
        });
        setForecast(forecastMap);
      }
      // Build hourly lookup: { '2026-03-30': [ { hour: 0, temp: 45.2, code: 3 }, ... ] }
      if (data.hourly) {
        const hMap = {};
        data.hourly.time.forEach((t, i) => {
          const [dateStr, timeStr] = t.split('T');
          const hour = parseInt(timeStr.split(':')[0]);
          if (!hMap[dateStr]) hMap[dateStr] = [];
          hMap[dateStr].push({ hour, temp: data.hourly.temperature_2m[i], code: data.hourly.weather_code[i] });
        });
        setHourlyForecast(hMap);
      }
    } catch (err) {
      console.log('Weather API error:', err);
    }
  };

  const getWeatherForDate = (dateStr) => {
    if (forecast[dateStr]) return forecast[dateStr];
    return null;
  };

  const parseTo24 = (timeStr) => {
    if (!timeStr || timeStr.includes('__') || timeStr === 'All Day') return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const p = match[3].toUpperCase();
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h + m / 60;
  };

  const getWeatherForTimeSlot = (dateStr, startStr, endStr) => {
    const hourlyData = hourlyForecast[dateStr];
    if (!hourlyData || !hourlyData.length) {
      return getWeatherForDate(dateStr);
    }
    if (startStr === 'All Day' || endStr === 'All Day') {
      return getWeatherForDate(dateStr);
    }
    const startH = parseTo24(startStr);
    const endH = parseTo24(endStr);
    if (startH == null || endH == null) return getWeatherForDate(dateStr);
    const filtered = hourlyData.filter(h => h.hour >= Math.floor(startH) && h.hour <= Math.ceil(endH));
    if (filtered.length === 0) return getWeatherForDate(dateStr);
    const avgTemp = Math.round(filtered.reduce((s, h) => s + h.temp, 0) / filtered.length);
    // Use the most common weather code in the range
    const codeCounts = {};
    filtered.forEach(h => { codeCounts[h.code] = (codeCounts[h.code] || 0) + 1; });
    const dominantCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0][0];
    const w = wmoToWeather(Number(dominantCode));
    return { icon: w.icon, temp: avgTemp, condition: w.condition };
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const toggleDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return;
    hapticMedium();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
      const newSlots = { ...eventData.dateTimeSlots };
      delete newSlots[dateStr];
      setEventData({ ...eventData, dateTimeSlots: newSlots });
    } else {
      setSelectedDates([...selectedDates, dateStr]);
      setEventData({
        ...eventData,
        dateTimeSlots: {
          ...eventData.dateTimeSlots,
          [dateStr]: [{ start: '__:__ AM', end: '__:__ AM' }]
        }
      });
    }
  };

  const addTimeSlot = (dateStr) => {
    setEventData({
      ...eventData,
      dateTimeSlots: {
        ...eventData.dateTimeSlots,
        [dateStr]: [...(eventData.dateTimeSlots[dateStr] || []), { start: '__:__ AM', end: '__:__ AM' }]
      }
    });
  };

  const updateTimeSlot = (dateStr, index, field, value) => {
    const slots = [...eventData.dateTimeSlots[dateStr]];
    slots[index] = { ...slots[index], [field]: value };
    setEventData({
      ...eventData,
      dateTimeSlots: { ...eventData.dateTimeSlots, [dateStr]: slots }
    });
  };

  const removeTimeSlot = (dateStr, index) => {
    const slots = eventData.dateTimeSlots[dateStr].filter((_, i) => i !== index);
    setEventData({
      ...eventData,
      dateTimeSlots: { ...eventData.dateTimeSlots, [dateStr]: slots }
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!eventData.title.trim()) {
        Alert.alert('Error', 'Please enter an event title');
        return;
      }
      hapticMedium();
      setStep(2);
    } else if (step === 2) {
      if (selectedDates.length === 0) {
        Alert.alert('Error', 'Please select at least one date');
        return;
      }
      hapticMedium();
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      hapticLight();
      setStep(step - 1);
    }
  };

  const addFriend = () => {
    if (!friendEmail.trim() || !friendName.trim()) {
      Alert.alert('Error', 'Please enter both name and email');
      return;
    }
    if (!friendEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    hapticSuccess();
    setEventData({
      ...eventData,
      friends: [...eventData.friends, { name: friendName, contact: friendEmail, type: 'email' }]
    });
    setFriendEmail('');
    setFriendName('');
  };

  const removeFriend = (index) => {
    setEventData({
      ...eventData,
      friends: eventData.friends.filter((_, i) => i !== index)
    });
  };

  const handleCreate = async () => {
    if (eventData.friends.length === 0) {
      Alert.alert('Error', 'Please invite at least one friend');
      return;
    }

    try {
      const userData = await AsyncStorage.getItem('mm_user');
      const user = userData ? JSON.parse(userData).user : null;

      const dateSlots = selectedDates.flatMap(date => 
        eventData.dateTimeSlots[date].map(slot => ({
          date,
          start: slot.start,
          end: slot.end
        }))
      );

      const filteredPollOptions = eventData.eventType === 'poll'
        ? eventData.pollOptions.filter(o => o.trim() !== '')
        : [];

      const newEvent = {
        id: Date.now().toString(),
        title: eventData.title,
        budget: eventData.budget,
        location: eventData.location,
        pollOptions: filteredPollOptions.length > 0 ? filteredPollOptions : null,
        pollVotes: filteredPollOptions.length > 0
          ? filteredPollOptions.reduce((acc, opt) => { acc[opt] = Math.floor(Math.random() * 4); return acc; }, {})
          : null,
        dates: selectedDates,
        times: dateSlots,
        dateSlots,
        friends: eventData.friends,
        status: 'pending',
        createdAt: new Date().toISOString(),
        responses: [],
        expenses: [],
        carpool: { drivers: [], riders: [] },
      };

      // Save event
      const existingEvents = await AsyncStorage.getItem('macromanage_events');
      const events = existingEvents ? JSON.parse(existingEvents) : [];
      events.push(newEvent);
      await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));

      // Save notification
      const existingNotifs = await AsyncStorage.getItem('notifications');
      const notifs = existingNotifs ? JSON.parse(existingNotifs) : [];
      notifs.unshift({
        id: Date.now().toString(),
        message: `New event "${eventData.title}" created with ${eventData.friends.length} friend(s)`,
        read: false,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem('notifications', JSON.stringify(notifs));

      // Send invitation emails via Mailjet API
      const MAILJET_API_KEY = '430ab455c64728deed9e13d962553e01';
      const MAILJET_SECRET_KEY = '4c1fdff48ecbdf8ec03f0817469fc163';
      const SENDER_EMAIL = 'jasonzhang072@gmail.com';
      const WEB_DOMAIN = 'https://macromanage-git-main-jasonzhang072-2414s-projects.vercel.app';

      const dateList = selectedDates.map(d => {
        const dt = new Date(d + 'T12:00:00');
        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }).join(', ');
      let emailsSent = 0;

      for (const friend of eventData.friends) {
        const baseUrl = `${WEB_DOMAIN}/respond.html?event=${newEvent.id}&email=${encodeURIComponent(friend.contact)}&title=${encodeURIComponent(eventData.title)}&host=${encodeURIComponent(user?.name || '')}&hostEmail=${encodeURIComponent(user?.email || '')}&location=${encodeURIComponent(eventData.location || '')}&budget=${encodeURIComponent(eventData.budget || '')}`;
        const acceptUrl = `${baseUrl}&response=accept`;
        const declineUrl = `${baseUrl}&response=decline`;

        const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EDE0CE;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
  <tr><td align="center" style="text-align:center;">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#FFF8F0;border-radius:24px;overflow:hidden;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg,#C09B74,#7D5A3C);padding:36px 32px;text-align:center;">
        <h1 style="color:#FFFFFF;font-size:26px;margin:0;letter-spacing:-0.5px;">You're Invited!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">${user?.name || 'Someone'} wants to hang out</p>
      </td></tr>
      <tr><td style="padding:32px 36px;text-align:center;">
        <div style="background:#FAF3E6;border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;">
          <div style="font-size:22px;font-weight:bold;color:#4A3728;">${eventData.title}</div>
        </div>
        ${eventData.location ? `<div style="background:#FAF3E6;border-radius:12px;padding:14px;margin-bottom:14px;text-align:center;">
          <div style="font-size:11px;color:#9A8568;font-weight:bold;margin-bottom:4px;letter-spacing:1px;">LOCATION</div>
          <div style="font-size:15px;color:#4A3728;font-weight:600;">${eventData.location}</div>
        </div>` : ''}
        ${eventData.budget ? `<div style="background:#FAF3E6;border-radius:12px;padding:14px;margin-bottom:14px;text-align:center;">
          <div style="font-size:11px;color:#9A8568;font-weight:bold;margin-bottom:4px;letter-spacing:1px;">BUDGET</div>
          <div style="font-size:15px;color:#4A3728;font-weight:600;">$${eventData.budget} per person</div>
        </div>` : ''}
        <p style="text-align:center;color:#8A7560;margin:20px 0;font-size:15px;">Tap below to respond</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="48%" align="center" style="padding-right:6px;">
              <a href="${acceptUrl}" target="_blank" style="display:block;background:#4CAF7D;color:#FFFFFF;text-decoration:none;padding:16px 8px;border-radius:50px;font-size:16px;font-weight:bold;text-align:center;mso-padding-alt:16px;">Accept</a>
            </td>
            <td width="4%"></td>
            <td width="48%" align="center" style="padding-left:6px;">
              <a href="${declineUrl}" target="_blank" style="display:block;background:#E8DBC4;color:#6B5744;text-decoration:none;padding:16px 8px;border-radius:50px;font-size:16px;font-weight:bold;text-align:center;mso-padding-alt:16px;">Decline</a>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#FAF3E6;padding:16px;text-align:center;border-top:1px solid #E8DBC4;">
        <p style="margin:0;font-size:12px;color:#9A8568;">Sent via <strong>MacroManage</strong></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

        try {
          const res = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + toBase64(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`),
            },
            body: JSON.stringify({
              Messages: [{
                From: { Email: SENDER_EMAIL, Name: 'MacroManage' },
                To: [{ Email: friend.contact, Name: friend.name }],
                Subject: `You're invited to: ${eventData.title}`,
                HTMLPart: htmlBody,
              }],
            }),
          });
          const result = await res.json();
          if (res.ok) {
            emailsSent++;
            console.log('Email sent to:', friend.contact);
          } else {
            console.warn('Mailjet error for:', friend.contact, result);
          }
        } catch (mailErr) {
          console.log('Email send failed for:', friend.contact, mailErr);
        }
      }
      if (emailsSent > 0) {
        console.log(`${emailsSent} invitation(s) sent via Mailjet`);
      }

      hapticSuccess();
      Alert.alert('Success', 'Event created and invitations sent!', [
        { text: 'OK', onPress: () => {
          setEventData({ title: '', budget: '', location: '', eventType: 'single', pollOptions: [], dates: [], dateTimeSlots: {}, friends: [] });
          setSelectedDates([]);
          setSelectedLocationCoords(null);
          setStep(1);
          navigation.navigate('Events');
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create event');
      console.error(error);
    }
  };

  const changeMonth = (direction) => {
    hapticLight();
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
  };

  return (
    <ScrollView 
      ref={scrollRef}
      style={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View>

      {/* Step Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3].map(s => (
          <View key={s} style={styles.progressStepWrap}>
            <Animated.View style={[
              styles.progressDot,
              { backgroundColor: s <= step ? theme.primary : (isDarkMode ? '#444' : '#E5D5B8') },
              s === step && { transform: [{ scale: 1.25 }], shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 }
            ]}>
              <Text style={{ color: s <= step ? '#fff' : theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{s}</Text>
            </Animated.View>
            <Text style={[styles.progressLabel, { color: s === step ? theme.primary : theme.textSecondary, fontWeight: s === step ? '700' : '400' }]}>
              {s === 1 ? 'Details' : s === 2 ? 'Dates' : 'Invite'}
            </Text>
          </View>
        ))}
        <View style={[styles.progressLine, { backgroundColor: isDarkMode ? '#444' : '#E5D5B8' }]}>
          <Animated.View style={[styles.progressLineFill, { backgroundColor: theme.primary, width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }]} />
        </View>
      </View>

      {step === 1 && (
        <Animated.View style={[styles.stepContainer, { opacity: stepFade, transform: [{ translateY: stepSlide }] }]}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Event Details</Text>
          
          <Text style={[styles.label, { color: theme.text }]}>Event Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={eventData.title}
            onChangeText={(text) => setEventData({ ...eventData, title: text })}
          />

          <Text style={[styles.label, { color: theme.text }]}>Budget (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={eventData.budget}
            onChangeText={(text) => setEventData({ ...eventData, budget: text })}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: theme.text }]}>Location (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={eventData.location}
            onChangeText={handleLocationChange}
          />

          {isGeocoding && (
            <Text style={[styles.geocodingText, { color: theme.textSecondary }]}>Finding location...</Text>
          )}

          {selectedLocationCoords && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
              >
                <Marker
                  coordinate={selectedLocationCoords}
                  title={eventData.location}
                  pinColor={theme.primary}
                />
              </MapView>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>Event Type</Text>
          <View style={[styles.toggleRow, { backgroundColor: isDarkMode ? '#3a3a3a' : '#F5F5F5', borderRadius: 12 }]}>
            <TouchableOpacity
              style={[styles.toggleOption, eventData.eventType === 'single' && { backgroundColor: theme.primary }]}
              onPress={() => { hapticSelection(); setEventData({ ...eventData, eventType: 'single', pollOptions: [] }); }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: eventData.eventType === 'single' ? '#fff' : theme.text }}>Single Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, eventData.eventType === 'poll' && { backgroundColor: theme.primary }]}
              onPress={() => {
                hapticSelection();
                const opts = eventData.pollOptions.length >= 2 ? eventData.pollOptions : ['', ''];
                setEventData({ ...eventData, eventType: 'poll', pollOptions: opts });
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: eventData.eventType === 'poll' ? '#fff' : theme.text }}>Poll (Vote on options)</Text>
            </TouchableOpacity>
          </View>

          {eventData.eventType === 'poll' && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: theme.text }]}>Activity Options:</Text>
              {eventData.pollOptions.map((opt, idx) => (
                <View key={idx} style={styles.pollOptionRow}>
                  <TextInput
                    style={[styles.input, styles.pollInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    value={opt}
                    onChangeText={(text) => {
                      const updated = [...eventData.pollOptions];
                      updated[idx] = text;
                      setEventData({ ...eventData, pollOptions: updated });
                    }}
                    placeholder={`Option ${idx + 1} (e.g., Movie Night, Dinner, Bowling)`}
                    placeholderTextColor={isDarkMode ? '#666' : '#bbb'}
                  />
                  {eventData.pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => {
                      const updated = eventData.pollOptions.filter((_, i) => i !== idx);
                      setEventData({ ...eventData, pollOptions: updated });
                    }} style={{ paddingHorizontal: 8 }}>
                      <Text style={{ fontSize: 18, color: '#EF4444', fontWeight: 'bold' }}>x</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {eventData.pollOptions.length < 5 && (
                <TouchableOpacity onPress={() => {
                  setEventData({ ...eventData, pollOptions: [...eventData.pollOptions, ''] });
                }} style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 14, color: '#3B82F6', fontWeight: '500' }}>+ Add Option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: nextBtnScale }] }}>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => bounceScale(nextBtnScale, handleNext)} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Next →</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View style={[styles.stepContainer, { opacity: stepFade, transform: [{ translateY: stepSlide }] }]}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Select Dates & Times</Text>
          
          <View style={[styles.calendarHeader, { backgroundColor: theme.card }]}>
            <TouchableOpacity onPress={() => changeMonth(-1)} activeOpacity={0.7}>
              <Text style={[styles.monthNav, { color: theme.primary }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} activeOpacity={0.7}>
              <Text style={[styles.monthNav, { color: theme.primary }]}>→</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.calendar, { backgroundColor: theme.card }]}>
            <View style={styles.weekDays}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={[styles.weekDay, { color: theme.textSecondary }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {getDaysInMonth(calendarMonth).map((date, idx) => {
                if (!date) return <View key={idx} style={styles.emptyDay} />;
                const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                const isSelected = selectedDates.includes(dateStr);
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                const isToday = dateStr === todayStr;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = date < today;
                const dayWeather = !isPast ? getWeatherForDate(dateStr) : null;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayButton,
                      isSelected && { backgroundColor: theme.primary },
                      isToday && !isSelected && { borderColor: theme.primary, borderWidth: 2 },
                      isPast && { opacity: 0.3 }
                    ]}
                    onPress={() => toggleDate(date)}
                    activeOpacity={isPast ? 1 : 0.7}
                    disabled={isPast}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: isSelected ? '#fff' : (isPast ? theme.textSecondary : theme.text) }
                    ]}>
                      {date.getDate()}
                    </Text>
                    {dayWeather && (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.dayWeatherEmoji}>{dayWeather.icon}</Text>
                        <Text style={[styles.dayWeatherTemp2, { color: isSelected ? '#fff' : theme.textSecondary }]}>
                          {dayWeather.temp}°
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedDates.length > 0 && (
            <View style={styles.timeSlotsSection}>
              <Text style={[styles.label, { color: theme.text }]}>Time Slots for Selected Dates:</Text>
              {selectedDates.map(dateStr => (
                <View key={dateStr} style={[styles.dateTimeCard, { backgroundColor: theme.card }]}>
                  {eventData.dateTimeSlots[dateStr]?.map((slot, idx) => {
                    const slotWeather = getWeatherForTimeSlot(dateStr, slot.start, slot.end);
                    const hasTime = slot.start && !slot.start.includes('__');
                    return (
                    <View key={idx}>
                      {idx === 0 && (
                        <View style={styles.dateLabelRow}>
                          <Text style={[styles.dateLabel, { color: theme.text }]}>
                            {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      )}
                      <View style={styles.timeSlotRow}>
                        <TouchableOpacity
                          style={[styles.timeButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#F5F5F5' }]}
                          onPress={() => { hapticLight(); setTimePickerSlot({ dateStr, idx }); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.timeButtonText, { color: theme.text }]}>{slot.start}</Text>
                          <Text style={[styles.timeButtonDash, { color: theme.textSecondary }]}>to</Text>
                          <Text style={[styles.timeButtonText, { color: theme.text }]}>{slot.end}</Text>
                        </TouchableOpacity>
                        {hasTime && slotWeather && (
                          <Animated.View style={[styles.slotWeatherBadge, {
                            backgroundColor: isDarkMode ? '#2a3a2a' : '#E8F5E9',
                            borderWidth: 1, borderColor: isDarkMode ? '#3a5a3a' : '#c8e6c9',
                            shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
                          }]}>
                            <Text style={{ fontSize: 16 }}>{slotWeather.icon}</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>{slotWeather.temp}°</Text>
                          </Animated.View>
                        )}
                        {eventData.dateTimeSlots[dateStr].length > 1 && (
                          <TouchableOpacity onPress={() => removeTimeSlot(dateStr, idx)} style={styles.removeSlotBtn}>
                            <Text style={styles.removeSlotText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.addSlotButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#F5F5F5', flex: 1 }]}
                      onPress={() => addTimeSlot(dateStr)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: theme.primary, fontWeight: '600' }}>+ Add Time Slot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addSlotButton, { backgroundColor: isDarkMode ? '#2a3a2a' : '#E8F5E9', flex: 1 }]}
                      onPress={() => {
                        hapticSelection();
                        setEventData(prev => ({
                          ...prev,
                          dateTimeSlots: { ...prev.dateTimeSlots, [dateStr]: [{ start: 'All Day', end: 'All Day' }] }
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: '#34A853', fontWeight: '600' }}>All Day ✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {timePickerSlot && eventData.dateTimeSlots[timePickerSlot.dateStr]?.[timePickerSlot.idx] && (
            <TimePickerModal
              visible={true}
              onClose={() => setTimePickerSlot(null)}
              startValue={eventData.dateTimeSlots[timePickerSlot.dateStr][timePickerSlot.idx].start}
              endValue={eventData.dateTimeSlots[timePickerSlot.dateStr][timePickerSlot.idx].end}
              onChangeBoth={(newStart, newEnd) => {
                const ds = timePickerSlot.dateStr;
                const i = timePickerSlot.idx;
                setEventData(prev => {
                  const slots = [...prev.dateTimeSlots[ds]];
                  slots[i] = { ...slots[i], start: newStart, end: newEnd };
                  return { ...prev, dateTimeSlots: { ...prev.dateTimeSlots, [ds]: slots } };
                });
              }}
              theme={theme}
              isDarkMode={isDarkMode}
            />
          )}

          <View style={styles.buttonRow}>
            <Animated.View style={{ flex: 1, transform: [{ scale: backBtnScale }] }}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#E5D5B7' }]} onPress={() => bounceScale(backBtnScale, handleBack)} activeOpacity={0.8}>
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>← Back</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={{ width: 12 }} />
            <Animated.View style={{ flex: 1, transform: [{ scale: nextBtnScale }] }}>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => bounceScale(nextBtnScale, handleNext)} activeOpacity={0.8}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View style={[styles.stepContainer, { opacity: stepFade, transform: [{ translateY: stepSlide }] }]}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Invite Friends</Text>

          {/* Quick-add from saved friends */}
          {savedFriends.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.label, { color: theme.text }]}>Your Friends</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {savedFriends.filter(sf => !eventData.friends.some(ef => (ef.contact || '').toLowerCase() === (sf.email || sf.contact || '').toLowerCase())).map((sf, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.quickChip, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5', borderColor: theme.border }]}
                    onPress={() => {
                      hapticSelection();
                      setEventData(prev => ({ ...prev, friends: [...prev.friends, { name: sf.name, contact: sf.email || sf.contact }] }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>+ {sf.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick-add from groups */}
          {savedGroups.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.label, { color: theme.text }]}>Groups</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {savedGroups.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.quickChip, { backgroundColor: isDarkMode ? '#2a3a2a' : '#E8F5E9', borderColor: isDarkMode ? '#4a5a4a' : '#C8E6C9' }]}
                    onPress={() => {
                      hapticSelection();
                      const newFriends = g.friends
                        .filter(gf => !eventData.friends.some(ef => ef.contact === (gf.email || gf.contact)))
                        .map(gf => ({ name: gf.name, contact: gf.email || gf.contact }));
                      if (newFriends.length > 0) {
                        setEventData(prev => ({ ...prev, friends: [...prev.friends, ...newFriends] }));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: isDarkMode ? '#81C784' : '#2E7D32', fontSize: 13, fontWeight: '600' }}>+ {g.name} ({g.friends.length})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>Friend Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={friendName}
            onChangeText={setFriendName}
          />

          <Text style={[styles.label, { color: theme.text }]}>Friend Email *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            value={friendEmail}
            onChangeText={setFriendEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Animated.View style={{ transform: [{ scale: addFriendBtnScale }] }}>
            <TouchableOpacity style={styles.addButton} onPress={() => bounceScale(addFriendBtnScale, addFriend)} activeOpacity={0.8}>
              <Text style={styles.addButtonText}>+ Add Friend</Text>
            </TouchableOpacity>
          </Animated.View>

          {eventData.friends.length > 0 && (
            <View style={styles.friendsList}>
              <Text style={[styles.label, { color: theme.text }]}>Invited Friends ({eventData.friends.length}):</Text>
              {eventData.friends.map((friend, idx) => (
                <View key={idx} style={[styles.friendItem, { backgroundColor: theme.card }]}>
                  <View>
                    <Text style={[styles.friendName, { color: theme.text }]}>{friend.name}</Text>
                    <Text style={[styles.friendEmail, { color: theme.textSecondary }]}>{friend.contact}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeFriend(idx)}>
                    <Text style={{ fontSize: 18, color: '#EF4444', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Animated.View style={{ flex: 1, transform: [{ scale: backBtnScale }] }}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#E5D5B7' }]} onPress={() => bounceScale(backBtnScale, handleBack)} activeOpacity={0.8}>
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>← Back</Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={{ width: 12 }} />
            <Animated.View style={{ flex: 1, transform: [{ scale: createBtnScale }] }}>
              <TouchableOpacity style={styles.createButton} onPress={() => bounceScale(createBtnScale, handleCreate)} activeOpacity={0.8}>
                <Text style={styles.createButtonText}>Create Event ✓</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 8,
    position: 'relative',
  },
  progressStepWrap: {
    alignItems: 'center',
    zIndex: 1,
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressLine: {
    position: 'absolute',
    left: 46,
    right: 46,
    top: 34,
    height: 3,
    borderRadius: 2,
  },
  progressLineFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    borderWidth: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  monthNav: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendar: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDay: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayButton: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayWeatherEmoji: {
    fontSize: 10,
    marginTop: 1,
  },
  dayWeatherTemp2: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -1,
  },
  timeSlotsSection: {
    marginTop: 16,
  },
  dateTimeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateWeatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dateWeatherTemp: {
    fontSize: 13,
    fontWeight: '600',
  },
  slotWeatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeButtonDash: {
    fontSize: 14,
  },
  removeSlotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  removeSlotText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  hintText: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 8,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pollInput: {
    flex: 1,
    marginBottom: 4,
  },
  addSlotButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  friendsList: {
    marginTop: 16,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    flex: 1,
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#10B981',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  geocodingText: {
    marginTop: 12,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  mapContainer: {
    marginTop: 16,
  },
  map: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  weatherIcon: {
    fontSize: 48,
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  weatherCondition: {
    fontSize: 14,
    marginTop: 2,
  },
});
