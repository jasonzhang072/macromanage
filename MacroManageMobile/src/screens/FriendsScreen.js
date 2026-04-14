import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated, RefreshControl, Modal, PanResponder, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../App';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '../utils/animations';

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

export default function FriendsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedForGroup, setSelectedForGroup] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState({});
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendExpenses, setFriendExpenses] = useState([]);
  const friendPanY = useRef(new Animated.Value(0)).current;
  const screenH = Dimensions.get('window').height;
  const friendPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) friendPanY.setValue(gs.dy);
      else friendPanY.setValue(gs.dy * 0.3);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 40 || gs.vy > 0.2) {
        Animated.timing(friendPanY, { toValue: screenH, duration: 200, useNativeDriver: true }).start(() => {
          setSelectedFriend(null);
          friendPanY.setValue(0);
        });
      } else {
        Animated.spring(friendPanY, { toValue: 0, tension: 200, friction: 12, useNativeDriver: true }).start();
      }
    },
  })).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { loadData(); });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const savedFriends = JSON.parse(await AsyncStorage.getItem('all_friends') || '[]');
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      const events = eventsData ? JSON.parse(eventsData) : [];
      const friendGroups = JSON.parse(await AsyncStorage.getItem('friend_groups') || '[]');

      // Merge friends from events + saved friends (dedup by email)
      const friendMap = new Map();
      savedFriends.forEach(f => {
        const key = (f.email || f.contact || '').toLowerCase();
        if (key) friendMap.set(key, { name: f.name, email: f.email || f.contact });
      });
      events.forEach(event => {
        (event.friends || []).forEach(f => {
          const key = (f.contact || f.email || '').toLowerCase();
          if (key && !friendMap.has(key)) {
            friendMap.set(key, { name: f.name || key.split('@')[0], email: f.contact || f.email });
          }
        });
      });

      setFriends(Array.from(friendMap.values()));
      setGroups(friendGroups);

      // Calculate balances from expenses across all events
      const bal = {}; // { friendName: netAmount } positive = they owe you, negative = you owe them
      events.forEach(event => {
        (event.expenses || []).forEach(exp => {
          if (!exp.paidBy || !exp.splitWith) return;
          const splitCount = exp.splitWith.length + (exp.splitWith.includes(exp.paidBy) ? 0 : 1);
          const perPerson = exp.amount / Math.max(splitCount, 1);
          if (exp.paidBy === 'Me') {
            // Friends in splitWith owe me
            exp.splitWith.forEach(name => {
              if (!bal[name]) bal[name] = 0;
              bal[name] += perPerson; // they owe me
            });
          } else {
            // A friend paid - if I'm in splitWith, I owe them
            const payer = exp.paidBy;
            if (!bal[payer]) bal[payer] = 0;
            // I owe the payer my share
            bal[payer] -= perPerson;
            // Other friends in splitWith also owe payer (tracked from payer's perspective)
            exp.splitWith.forEach(name => {
              if (name === payer) return;
              if (!bal[name]) bal[name] = 0;
              // This friend owes the payer, not me - but we simplify to track vs "Me" only
            });
          }
        });
      });
      setBalances(bal);
    } catch (e) {
      console.log('Load friends error:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openFriendDetail = async (friend) => {
    hapticLight();
    friendPanY.setValue(0);
    setSelectedFriend(friend);
    try {
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      const events = eventsData ? JSON.parse(eventsData) : [];
      const expHistory = [];
      events.forEach(event => {
        (event.expenses || []).forEach(exp => {
          if (!exp.paidBy || !exp.splitWith) return;
          const name = friend.name;
          const isInvolved = exp.paidBy === name || exp.splitWith.includes(name) || (exp.paidBy === 'Me' && exp.splitWith.includes(name));
          if (!isInvolved) return;
          const splitCount = exp.splitWith.length + (exp.splitWith.includes(exp.paidBy) ? 0 : 1);
          const perPerson = exp.amount / Math.max(splitCount, 1);
          let impact = 0;
          if (exp.paidBy === 'Me' && exp.splitWith.includes(name)) {
            impact = perPerson; // they owe me
          } else if (exp.paidBy === name) {
            impact = -perPerson; // I owe them
          }
          if (impact !== 0) {
            expHistory.push({
              eventTitle: event.title,
              description: exp.description,
              amount: exp.amount,
              paidBy: exp.paidBy,
              impact,
              timestamp: exp.timestamp,
            });
          }
        });
      });
      setFriendExpenses(expHistory);
    } catch (e) {
      setFriendExpenses([]);
    }
  };

  const addFriend = async () => {
    if (!friendName.trim() || !friendEmail.trim()) {
      Alert.alert('Missing Info', 'Please enter both name and email');
      return;
    }
    if (!friendEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (friends.some(f => f.email === friendEmail.trim())) {
      Alert.alert('Duplicate', 'This friend already exists!');
      return;
    }

    hapticSuccess();
    const updated = [...friends, { name: friendName.trim(), email: friendEmail.trim() }];
    setFriends(updated);
    await AsyncStorage.setItem('all_friends', JSON.stringify(updated));
    setFriendName('');
    setFriendEmail('');
  };

  const removeFriend = async (idx) => {
    Alert.alert('Remove Friend', `Remove ${friends[idx].name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          hapticLight();
          const updated = friends.filter((_, i) => i !== idx);
          setFriends(updated);
          await AsyncStorage.setItem('all_friends', JSON.stringify(updated));
        }
      }
    ]);
  };

  const toggleFriendForGroup = (idx) => {
    hapticSelection();
    setSelectedForGroup(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Missing Name', 'Please enter a group name');
      return;
    }
    if (selectedForGroup.length === 0) {
      Alert.alert('No Friends', 'Please select at least one friend');
      return;
    }

    hapticSuccess();
    const selectedFriends = selectedForGroup.map(idx => ({
      name: friends[idx].name,
      contact: friends[idx].email,
      type: 'email',
    }));

    const updated = [...groups, { name: groupName.trim(), friends: selectedFriends }];
    setGroups(updated);
    await AsyncStorage.setItem('friend_groups', JSON.stringify(updated));
    setGroupName('');
    setSelectedForGroup([]);
    setShowCreateGroup(false);
  };

  const deleteGroup = async (idx) => {
    Alert.alert('Delete Group', `Delete "${groups[idx].name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          hapticLight();
          const updated = groups.filter((_, i) => i !== idx);
          setGroups(updated);
          await AsyncStorage.setItem('friend_groups', JSON.stringify(updated));
        }
      }
    ]);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name[0].toUpperCase();
  };

  const avatarColors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Add Friend */}
      <SpringCard style={[styles.card, { backgroundColor: theme.card }]} delay={60}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Add Friend</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5', borderColor: theme.border, color: theme.text, flex: 1 }]}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
            value={friendName}
            onChangeText={setFriendName}
          />
          <TextInput
            style={[styles.input, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5', borderColor: theme.border, color: theme.text, flex: 1 }]}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={friendEmail}
            onChangeText={setFriendEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={addFriend}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Friend</Text>
        </TouchableOpacity>
      </SpringCard>

      {/* All Friends */}
      <SpringCard style={[styles.card, { backgroundColor: theme.card }]} delay={150}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          All Friends ({friends.length})
        </Text>
        {friends.length > 0 ? friends.map((f, idx) => {
          const bal = balances[f.name] || 0;
          return (
          <Animated.View key={f.email || idx}>
            <TouchableOpacity
              style={[styles.friendRow, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f9f5ee', borderColor: theme.border }]}
              onPress={() => openFriendDetail(f)}
              onLongPress={() => removeFriend(idx)}
              activeOpacity={0.7}
            >
              <View style={[styles.friendAvatar, { backgroundColor: avatarColors[idx % avatarColors.length] }]}>
                <Text style={styles.friendAvatarText}>{getInitials(f.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.friendName, { color: theme.text }]}>{f.name}</Text>
                <Text style={[styles.friendEmail, { color: theme.textSecondary }]}>{f.email}</Text>
              </View>
              {bal !== 0 && (
                <View style={[styles.balanceBadge, { backgroundColor: bal > 0 ? (isDarkMode ? '#1a3a1a' : '#ecfdf5') : (isDarkMode ? '#3a1a1a' : '#fef2f2') }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: bal > 0 ? '#10B981' : '#EF4444' }}>
                    {bal > 0 ? `Owes $${bal.toFixed(2)}` : `You owe $${Math.abs(bal).toFixed(2)}`}
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={() => removeFriend(idx)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: '#EF4444' }}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
          );
        }) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No friends added yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Add friends above to get started</Text>
          </View>
        )}
      </SpringCard>

      {/* Groups */}
      <SpringCard style={[styles.card, { backgroundColor: theme.card }]} delay={240}>
        <View style={styles.groupHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
            Groups ({groups.length})
          </Text>
          <TouchableOpacity
            onPress={() => { hapticLight(); setShowCreateGroup(!showCreateGroup); }}
            style={[styles.newGroupBtn, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5' }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary }}>
              {showCreateGroup ? 'Cancel' : '+ New Group'}
            </Text>
          </TouchableOpacity>
        </View>

        {showCreateGroup && (
          <View style={[styles.createGroupBox, { backgroundColor: isDarkMode ? '#333' : '#faf6ed', borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: isDarkMode ? '#3a3a3a' : '#fff', borderColor: theme.border, color: theme.text }]}
              placeholder="Group Name (e.g. College Friends)"
              placeholderTextColor={theme.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
            />
            <Text style={[styles.selectLabel, { color: theme.textSecondary }]}>Select friends to add:</Text>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {friends.map((f, idx) => {
                const selected = selectedForGroup.includes(idx);
                return (
                  <TouchableOpacity
                    key={f.email || idx}
                    style={[
                      styles.checkRow,
                      { backgroundColor: selected ? (isDarkMode ? '#2a4a2a' : '#ecfdf5') : 'transparent', borderColor: theme.border }
                    ]}
                    onPress={() => toggleFriendForGroup(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkBox, selected && { backgroundColor: '#10B981', borderColor: '#10B981' }, !selected && { borderColor: theme.textSecondary }]}>
                      {selected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={[styles.checkLabel, { color: theme.text }]}>{f.name}</Text>
                    <Text style={[styles.checkEmail, { color: theme.textSecondary }]}>{f.email}</Text>
                  </TouchableOpacity>
                );
              })}
              {friends.length === 0 && (
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingVertical: 12 }}>Add friends first</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={createGroup}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        )}

        {groups.length > 0 ? groups.map((g, idx) => (
          <View key={idx} style={[styles.groupCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f9f5ee', borderColor: theme.border }]}>
            <View style={styles.groupCardHeader}>
              <View>
                <Text style={[styles.groupName, { color: theme.text }]}>{g.name}</Text>
                <Text style={[styles.groupCount, { color: theme.textSecondary }]}>{g.friends.length} member{g.friends.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteGroup(idx)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.groupMembers}>
              {g.friends.map((f, fi) => (
                <View key={fi} style={[styles.memberChip, { backgroundColor: isDarkMode ? '#444' : '#fff' }]}>
                  <Text style={{ fontSize: 13, color: theme.text }}>{f.name || f.contact}</Text>
                </View>
              ))}
            </View>
          </View>
        )) : (
          !showCreateGroup && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No groups yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Create a group to quickly invite multiple friends</Text>
            </View>
          )
        )}
      </SpringCard>
    </ScrollView>

    {/* Friend Detail Modal */}
    <Modal visible={!!selectedFriend} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Animated.View style={[styles.detailModal, { backgroundColor: theme.card, transform: [{ translateY: friendPanY }] }]}>
          <View {...friendPanResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 16 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#ccc' }} />
          </View>
          {selectedFriend && (() => {
            const bal = balances[selectedFriend.name] || 0;
            return (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={[styles.friendAvatar, { backgroundColor: '#F59E0B', width: 56, height: 56, borderRadius: 28, marginBottom: 10 }]}>
                    <Text style={[styles.friendAvatarText, { fontSize: 22 }]}>{getInitials(selectedFriend.name)}</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>{selectedFriend.name}</Text>
                  <Text style={{ fontSize: 14, color: theme.textSecondary }}>{selectedFriend.email}</Text>
                </View>

                <View style={[styles.balanceCard, {
                  backgroundColor: bal === 0 ? (isDarkMode ? '#2a2a2a' : '#f5f0e5') : bal > 0 ? (isDarkMode ? '#1a3a1a' : '#ecfdf5') : (isDarkMode ? '#3a1a1a' : '#fef2f2'),
                  borderWidth: 1.5,
                  borderColor: bal === 0 ? (isDarkMode ? '#444' : '#e5d5b8') : bal > 0 ? (isDarkMode ? '#065f46' : '#a7f3d0') : (isDarkMode ? '#991b1b' : '#fca5a5'),
                  shadowColor: bal > 0 ? '#10B981' : bal < 0 ? '#EF4444' : '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: bal !== 0 ? 0.2 : 0.05,
                  shadowRadius: 10, elevation: bal !== 0 ? 4 : 1,
                }]}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, marginBottom: 10, letterSpacing: 1.5 }}>BALANCE</Text>
                  {bal === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 24, marginBottom: 4 }}>🤝</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>All settled up</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bal < 0 ? '#EF4444' : (isDarkMode ? '#444' : '#ddd') }} />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: bal < 0 ? (isDarkMode ? '#fca5a5' : '#991b1b') : (isDarkMode ? '#555' : '#bbb') }}>You owe {selectedFriend.name}:</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: bal < 0 ? '#EF4444' : (isDarkMode ? '#555' : '#bbb'), letterSpacing: -0.5 }}>${bal < 0 ? Math.abs(bal).toFixed(2) : '0.00'}</Text>
                      </View>
                      {/* Visual balance bar */}
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: isDarkMode ? '#333' : '#e5e5e5', overflow: 'hidden' }}>
                        <View style={{
                          height: '100%', borderRadius: 3,
                          width: bal > 0 ? '100%' : `${Math.min(Math.abs(bal) * 10, 100)}%`,
                          backgroundColor: bal > 0 ? '#10B981' : bal < 0 ? '#EF4444' : 'transparent',
                        }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bal > 0 ? '#10B981' : (isDarkMode ? '#444' : '#ddd') }} />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: bal > 0 ? (isDarkMode ? '#a7f3d0' : '#065f46') : (isDarkMode ? '#555' : '#bbb') }}>{selectedFriend.name} owes you:</Text>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: bal > 0 ? '#10B981' : (isDarkMode ? '#555' : '#bbb'), letterSpacing: -0.5 }}>${bal > 0 ? bal.toFixed(2) : '0.00'}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {friendExpenses.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 8 }}>Expense History</Text>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {friendExpenses.map((exp, i) => (
                        <View key={i} style={[styles.expHistoryItem, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.text }}>{exp.description}</Text>
                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{exp.eventTitle} · Paid by {exp.paidBy}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: exp.impact > 0 ? '#10B981' : '#EF4444' }}>
                            {exp.impact > 0 ? '+' : '-'}${Math.abs(exp.impact).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {friendExpenses.length === 0 && (
                  <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingVertical: 16 }}>No shared expenses yet</Text>
                )}
              </>
            );
          })()}

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
            onPress={() => { Animated.timing(friendPanY, { toValue: screenH, duration: 250, useNativeDriver: true }).start(() => { setSelectedFriend(null); friendPanY.setValue(0); }); }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
  },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    gap: 12,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  friendEmail: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  newGroupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createGroupBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  selectLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  checkEmail: {
    fontSize: 12,
  },
  groupCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupCount: {
    fontSize: 12,
    marginTop: 2,
  },
  groupMembers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  detailModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  balanceCard: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  expHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  closeBtn: {
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
});
