import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { hapticMedium, hapticLight } from '../utils/animations';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const titleSlide = useRef(new Animated.Value(-20)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(titleSlide, { toValue: 0, tension: 30, friction: 6, useNativeDriver: true }),
      ]),
      Animated.spring(slideAnim, { toValue: 0, tension: 35, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = () => {
    hapticMedium();
    if (!name.trim() || !email.trim()) {
      alert('Please enter both name and email');
      return;
    }
    if (!email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    onLogin(name.trim(), email.trim());
  };

  const onBtnPressIn = () => {
    hapticLight();
    Animated.spring(btnScale, { toValue: 0.93, tension: 400, friction: 8, useNativeDriver: true }).start();
  };
  const onBtnPressOut = () => {
    Animated.spring(btnScale, { toValue: 1, tension: 250, friction: 6, useNativeDriver: true }).start();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View style={[styles.titleSection, { opacity: fadeAnim, transform: [{ translateY: titleSlide }] }]}>
        <Text style={styles.title}>Welcome to MacroManage</Text>
        <Text style={styles.subtitle}>Preserve Human Connection</Text>
      </Animated.View>

      <Animated.View 
        style={[
          styles.form,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.formTitle}>Sign In / Sign Up</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Your Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholderTextColor="#bbb"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#bbb"
        />
        
        <AnimatedTouchable
          style={[styles.button, { transform: [{ scale: btnScale }] }]}
          onPress={handleSubmit}
          onPressIn={onBtnPressIn}
          onPressOut={onBtnPressOut}
          activeOpacity={1}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </AnimatedTouchable>
        
        <Text style={styles.disclaimer}>
          Your data is stored locally on your device
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF6E9',
    justifyContent: 'center',
    padding: 24,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#7D6245',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#9A7B5A',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7D6245',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F5EBD8',
    color: '#7D6245',
  },
  button: {
    backgroundColor: '#B8956E',
    borderRadius: 30,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: 12,
    color: '#9A7B5A',
    textAlign: 'center',
    marginTop: 16,
  },
});
