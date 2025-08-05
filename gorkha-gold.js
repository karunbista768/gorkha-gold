import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { RewardedAd, AdEventType, TestIds, BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import DeviceInfo from 'react-native-device-info';

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBQYZtvmjRDeo95CthmEZ83J4GqL2si2fE",
  authDomain: "gorkha-gold.firebaseapp.com",
  projectId: "gorkha-gold",
  storageBucket: "gorkha-gold.firebasestorage.app",
  messagingSenderId: "318431509399",
  appId: "1:318431509399:android:0059cd41d3bf3f0f3222d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// AdMob configuration
const ADMOB_APP_ID = 'ca-app-pub-5777135562869525~8096544416';
const BANNER_AD_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-5777135562869525/7382244450';
const INTERSTITIAL_AD_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-5777135562869525/7386113889';
const REWARDED_AD_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-5777135562869525/3183947320';

// Initialize Ads
const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_ID);

export default function App() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('esewa');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);
  const [videosWatched, setVideosWatched] = useState(0);

  // Get device ID on app start
  useEffect(() => {
    const getDeviceId = async () => {
      const id = await DeviceInfo.getUniqueId();
      setDeviceId(id);
    };
    getDeviceId();

    // Check if user is already logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getUserData(user.uid);
        if (userDoc) {
          // Check device ID
          if (userDoc.deviceId && userDoc.deviceId !== deviceId) {
            Alert.alert('Error', 'This account is already logged in on another device');
            await auth.signOut();
            return;
          }
          setUser(userDoc);
          setBalance(userDoc.balance || 0);
          setTotalEarned(userDoc.totalEarned || 0);
          setVideosWatched(userDoc.videosWatched || 0);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Set up rewarded ad listener
  useEffect(() => {
    const unsubscribeLoaded = rewardedAd.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoading(false);
    });
    const unsubscribeEarned = rewardedAd.addAdEventListener(AdEventType.EARNED_REWARD, async (reward) => {
      const earnings = 0.10; // NPR 0.10 per video
      const newBalance = balance + earnings;
      const newTotalEarned = totalEarned + earnings;
      const newVideosWatched = videosWatched + 1;
      
      setBalance(newBalance);
      setTotalEarned(newTotalEarned);
      setVideosWatched(newVideosWatched);
      
      // Update in Firestore
      await updateUserData(user.uid, {
        balance: newBalance,
        totalEarned: newTotalEarned,
        videosWatched: newVideosWatched
      });
      
      Alert.alert('Reward Earned', `You earned NPR ${earnings.toFixed(2)}!`);
    });
    
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
    };
  }, [balance, totalEarned, videosWatched, user]);

  // Check if username or email already exists
  const checkUserExists = async (email, username) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) return true;
    
    const q2 = query(usersRef, where('email', '==', email));
    const querySnapshot2 = await getDocs(q2);
    return !querySnapshot2.empty;
  };

  // Get user data from Firestore
  const getUserData = async (userId) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  };

  // Update user data in Firestore
  const updateUserData = async (userId, data) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docRef = doc(db, 'users', querySnapshot.docs[0].id);
      await updateDoc(docRef, data);
    }
  };

  // Handle user sign up
  const handleSignUp = async () => {
    if (!username || !fullName || !email || !mobile || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    
    // Check password complexity
    if (!/(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{8,}/.test(password)) {
      Alert.alert('Error', 'Password must be 8+ chars with uppercase, symbol, and number');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Check if user already exists
      const exists = await checkUserExists(email, username);
      if (exists) {
        Alert.alert('Error', 'Username or email already exists');
        setIsLoading(false);
        return;
      }
      
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Add user to Firestore
      await addDoc(collection(db, 'users'), {
        userId: userCredential.user.uid,
        username,
        fullName,
        email,
        mobile,
        balance: 0,
        totalEarned: 0,
        videosWatched: 0,
        deviceId,
        createdAt: new Date()
      });
      
      Alert.alert('Success', 'Account created successfully!');
      setShowRegister(false);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  // Handle user login
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  // Handle video watching reward
  const watchVideo = () => {
    setIsLoading(true);
    rewardedAd.load();
  };

  // Handle withdrawal request
  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (amount > balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    
    // Calculate admin cut (60%) and charges (15%)
    const adminCut = amount * 0.6;
    const charges = amount * 0.15;
    const userReceives = amount * 0.4 - charges;
    
    try {
      setIsLoading(true);
      
      // Add withdrawal request to Firestore
      await addDoc(collection(db, 'withdrawals'), {
        userId: user.userId,
        username: user.username,
        grossAmount: amount,
        adminCut,
        charges,
        netAmount: userReceives,
        method: withdrawMethod,
        status: 'pending',
        createdAt: new Date()
      });
      
      // Update user balance
      const newBalance = balance - amount;
      setBalance(newBalance);
      await updateUserData(user.userId, { balance: newBalance });
      
      Alert.alert('Success', `Withdrawal request for NPR ${amount.toFixed(2)} submitted. You will receive NPR ${userReceives.toFixed(2)} after charges.`);
      setWithdrawAmount('');
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setBalance(0);
      setTotalEarned(0);
      setVideosWatched(0);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Render login/signup screen if not authenticated
  if (!user) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Gorkha Gold</Text>
        
        {showRegister ? (
          <>
            <Text style={styles.subtitle}>Create New Account</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Mobile Number"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (8+ chars with symbol, number, uppercase)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.buttonContainer}>
              <Button 
                title="Register" 
                onPress={handleSignUp} 
                disabled={isLoading}
              />
            </View>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.linkText} onPress={() => setShowRegister(false)}>
                Login
              </Text>
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Login to Your Account</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.buttonContainer}>
              <Button 
                title="Login" 
                onPress={handleLogin} 
                disabled={isLoading}
              />
            </View>
            <Text style={styles.switchText}>
              Don't have an account?{' '}
              <Text style={styles.linkText} onPress={() => setShowRegister(true)}>
                Register
              </Text>
            </Text>
          </>
        )}
        
        {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
        
        {/* Ad Banner */}
        <View style={styles.adContainer}>
          <BannerAd
            unitId={BANNER_AD_ID}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      </ScrollView>
    );
  }

  // Render main app after authentication
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {user.username}</Text>
        <Button title="Logout" onPress={handleLogout} />
      </View>
      
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Your Balance</Text>
        <Text style={styles.balanceAmount}>NPR {balance.toFixed(2)}</Text>
        <Text style={styles.balanceSubtext}>Total Earned: NPR {totalEarned.toFixed(2)}</Text>
        <Text style={styles.balanceSubtext}>Videos Watched: {videosWatched}</Text>
      </View>
      
      {/* Earn Money Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earn Money</Text>
        <View style={styles.earnCard}>
          <Text style={styles.earnMethod}>1. Watch Videos</Text>
          <Text style={styles.earnDescription}>Earn NPR 0.10 per video watched</Text>
          <View style={styles.buttonContainer}>
            <Button 
              title="Watch Video (+NPR 0.10)" 
              onPress={watchVideo} 
              disabled={isLoading}
            />
          </View>
        </View>
        
        <View style={styles.earnCard}>
          <Text style={styles.earnMethod}>2. Live Hosting</Text>
          <Text style={styles.earnDescription}>Earn gifts from your followers</Text>
          <Text style={styles.comingSoon}>Coming Soon</Text>
        </View>
      </View>
      
      {/* Withdraw Money Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdraw Money</Text>
        <Text style={styles.note}>Admin gets 60%, you get 40% minus 15% charges</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Amount (NPR)"
          keyboardType="numeric"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
        />
        
        <Text style={styles.withdrawMethodTitle}>Withdraw Method:</Text>
        <View style={styles.methodButtons}>
          <View style={styles.methodButton}>
            <Button 
              title="eSewa" 
              onPress={() => setWithdrawMethod('esewa')} 
              color={withdrawMethod === 'esewa' ? '#4CAF50' : '#CCCCCC'}
            />
          </View>
          <View style={styles.methodButton}>
            <Button 
              title="Khalti" 
              onPress={() => setWithdrawMethod('khalti')} 
              color={withdrawMethod === 'khalti' ? '#4CAF50' : '#CCCCCC'}
            />
          </View>
          <View style={styles.methodButton}>
            <Button 
              title="IME Pay" 
              onPress={() => setWithdrawMethod('imepay')} 
              color={withdrawMethod === 'imepay' ? '#4CAF50' : '#CCCCCC'}
            />
          </View>
          <View style={styles.methodButton}>
            <Button 
              title="Bank" 
              onPress={() => setWithdrawMethod('bank')} 
              color={withdrawMethod === 'bank' ? '#4CAF50' : '#CCCCCC'}
            />
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Request Withdrawal" 
            onPress={handleWithdraw} 
            disabled={isLoading || !withdrawAmount}
          />
        </View>
      </View>
      
      {/* Deposit Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deposit Money</Text>
        <Text style={styles.note}>No charges for deposits</Text>
        <Text style={styles.comingSoon}>IME Pay & Bank - Coming Soon</Text>
        <Text style={styles.comingSoon}>eSewa & Khalti - Coming Soon</Text>
      </View>
      
      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
      
      {/* Ad Banner */}
      <View style={styles.adContainer}>
        <BannerAd
          unitId={BANNER_AD_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#555',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginVertical: 10,
  },
  switchText: {
    marginTop: 15,
    textAlign: 'center',
    color: '#666',
  },
  linkText: {
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceCard: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 5,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  balanceSubtext: {
    color: '#e0e0e0',
    fontSize: 14,
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  earnCard: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  earnMethod: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  earnDescription: {
    color: '#666',
    marginBottom: 10,
  },
  note: {
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  withdrawMethodTitle: {
    marginBottom: 10,
    color: '#333',
  },
  methodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  methodButton: {
    width: '48%',
    marginBottom: 10,
  },
  comingSoon: {
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 5,
  },
  adContainer: {
    alignSelf: 'center',
    marginVertical: 20,
  },
});