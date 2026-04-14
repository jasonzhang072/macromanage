import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, Image, ActionSheetIOS, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../App';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '../utils/animations';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressableCard({ children, style, onPress, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(36)).current;

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
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { opacity: entrance, transform: [{ scale }, { translateY: slideUp }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

export default function ProfileScreen({ navigation, user, onLogout }) {
  const { theme, isDarkMode } = useTheme();
  const [profilePicture, setProfilePicture] = useState(null);
  const headerScale = useRef(new Animated.Value(0.92)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const avatarSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfilePicture();
    Animated.parallel([
      Animated.spring(headerScale, { toValue: 1, tension: 35, friction: 6, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadProfilePicture = async () => {
    try {
      const pic = await AsyncStorage.getItem('profile_picture');
      if (pic) setProfilePicture(pic);
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  };

  const isImageUri = (val) => {
    if (!val) return false;
    return val.startsWith('/') || val.startsWith('file:') || val.startsWith('ph:') || val.startsWith('assets-library:') || val.startsWith('content:');
  };

  const savePicture = async (uri) => {
    await AsyncStorage.setItem('profile_picture', uri);
    setProfilePicture(uri);
    // Bounce avatar on change
    Animated.sequence([
      Animated.spring(avatarSpin, { toValue: 1, tension: 300, friction: 6, useNativeDriver: true }),
      Animated.spring(avatarSpin, { toValue: 0, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    hapticSuccess();
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take a photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        savePicture(result.assets[0].uri);
      }
    } catch (e) {
      console.log('Camera error:', e);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        savePicture(result.assets[0].uri);
      }
    } catch (e) {
      console.log('Library error:', e);
    }
  };

  const changeProfilePicture = () => {
    hapticLight();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Use Emoji', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
          title: 'Change Profile Picture',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          else if (buttonIndex === 2) pickFromLibrary();
          else if (buttonIndex === 3) selectEmoji();
          else if (buttonIndex === 4) useInitials();
        }
      );
    } else {
      Alert.alert('Change Profile Picture', 'Choose an option', [
        { text: 'Take Photo', onPress: pickFromCamera },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const selectEmoji = () => {
    const emojis = ['😀', '😎', '🤓', '🥳', '😇', '🤩', '🚀', '🎯', '⭐', '🔥', '💡', '🎨'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', ...emojis],
        cancelButtonIndex: 0,
        title: 'Choose Your Emoji',
      },
      (buttonIndex) => {
        if (buttonIndex > 0) {
          savePicture(emojis[buttonIndex - 1]);
        }
      }
    );
  };

  const useInitials = async () => {
    await AsyncStorage.removeItem('profile_picture');
    setProfilePicture(null);
    hapticLight();
  };

  const handleLogout = () => {
    hapticMedium();
    Alert.alert(
      'Log Out',
      'Are you sure? Your data will remain saved locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: onLogout, style: 'destructive' }
      ]
    );
  };

  const avatarBounce = avatarSpin.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.header, { backgroundColor: theme.primary, opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
        <TouchableOpacity onPress={changeProfilePicture} activeOpacity={0.8}>
          <Animated.View style={[styles.avatar, { transform: [{ scale: avatarBounce }] }]}>
            {isImageUri(profilePicture) ? (
              <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
            ) : profilePicture ? (
              <Text style={styles.avatarEmoji}>{profilePicture}</Text>
            ) : (
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            )}
          </Animated.View>
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </Animated.View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Account</Text>
        <PressableCard style={[styles.card, { backgroundColor: theme.card }]} delay={100}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{user.name}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{user.email}</Text>
          </View>
        </PressableCard>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
        <PressableCard style={[styles.card, { backgroundColor: theme.card }]} delay={200}>
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
            MacroManage helps you preserve human connection by making event planning effortless.
          </Text>
          <Text style={[styles.version, { color: theme.textSecondary }]}>Version 1.0.0</Text>
        </PressableCard>
      </View>

      <PressableCard
        style={styles.logoutButton}
        onPress={handleLogout}
        delay={300}
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </PressableCard>

      <Text style={[styles.footerText, { color: theme.textSecondary }]}>Preserve Human Connection</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#654321',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  editBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7D6245',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  email: {
    fontSize: 15,
    color: '#E5D5B7',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
    marginLeft: 4,
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  version: {
    fontSize: 12,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#EF4444',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
