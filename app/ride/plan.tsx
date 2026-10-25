import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { LocationPickerModal } from '../../src/components/map/LocationPickerModal';
import { showAppAlert } from '../../src/utils/alert';

export default function PlanRideScreen() {
  const { user } = useAuthStore();
  const { createRide } = useRideStore();

  const [rideName, setRideName] = useState('');
  const [meetingName, setMeetingName] = useState('');
  const [meetingLat, setMeetingLat] = useState('22.7196');
  const [meetingLng, setMeetingLng] = useState('75.8577');
  const [destName, setDestName] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [loading, setLoading] = useState(false);

  // Map Picker State
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'meeting' | 'destination'>('meeting');

  const handleOpenPicker = (target: 'meeting' | 'destination') => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const handleLocationPicked = (loc: { name: string; lat: number; lng: number }) => {
    if (pickerTarget === 'meeting') {
      setMeetingName(loc.name);
      setMeetingLat(loc.lat.toFixed(5));
      setMeetingLng(loc.lng.toFixed(5));
    } else {
      setDestName(loc.name);
      setDestLat(loc.lat.toFixed(5));
      setDestLng(loc.lng.toFixed(5));
    }
  };

  const handleNextReviewRoute = () => {
    if (!rideName.trim()) {
      showAppAlert('Missing Ride Name', 'Please enter a name for your ride.');
      return;
    }
    if (!meetingName.trim() || !meetingLat || !meetingLng) {
      showAppAlert('Missing Meeting Point', 'Please select or enter the start/meeting point.');
      return;
    }
    if (!destName.trim() || !destLat || !destLng) {
      showAppAlert('Missing Destination', 'Please select or enter the ride destination.');
      return;
    }

    router.push({
      pathname: '/ride/route-preview',
      params: {
        name: rideName.trim(),
        meetingName: meetingName.trim(),
        meetingLat,
        meetingLng,
        destName: destName.trim(),
        destLat,
        destLng,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Ride</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Ride Name */}
        <Text style={styles.sectionLabel}>Ride Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Indore to Bhopal Ride 🏍"
          placeholderTextColor="#999"
          value={rideName}
          onChangeText={setRideName}
          maxLength={100}
        />

        {/* Meeting Point Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>📍 Meeting Point (Start)</Text>
          <TouchableOpacity
            style={styles.pickMapBtn}
            onPress={() => handleOpenPicker('meeting')}
          >
            <Text style={styles.pickMapBtnText}>🗺 Pick on Map</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Where riders gather before starting</Text>

        <TextInput
          style={styles.input}
          placeholder="Location name (or pick on map)"
          placeholderTextColor="#999"
          value={meetingName}
          onChangeText={setMeetingName}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Latitude"
            placeholderTextColor="#999"
            value={meetingLat}
            onChangeText={setMeetingLat}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Longitude"
            placeholderTextColor="#999"
            value={meetingLng}
            onChangeText={setMeetingLng}
            keyboardType="numeric"
          />
        </View>

        {/* Destination Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionLabel}>🏁 Destination</Text>
          <TouchableOpacity
            style={[styles.pickMapBtn, styles.pickMapBtnDest]}
            onPress={() => handleOpenPicker('destination')}
          >
            <Text style={styles.pickMapBtnText}>🗺 Pick on Map</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Where the group ride finishes</Text>

        <TextInput
          style={styles.input}
          placeholder="Destination name (or pick on map)"
          placeholderTextColor="#999"
          value={destName}
          onChangeText={setDestName}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Latitude"
            placeholderTextColor="#999"
            value={destLat}
            onChangeText={setDestLat}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Longitude"
            placeholderTextColor="#999"
            value={destLng}
            onChangeText={setDestLng}
            keyboardType="numeric"
          />
        </View>

        {/* Tip Box */}
        <View style={styles.tip}>
          <Text style={styles.tipText}>
            💡 Tap <Text style={{ fontWeight: '700' }}>"🗺 Pick on Map"</Text> above to search any landmark or click directly on the interactive map to drop a pin!
          </Text>
        </View>

        {/* Next: Review Route Button */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleNextReviewRoute}
        >
          <Text style={styles.createBtnText}>Next: Review Route on Map 🗺 →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Interactive Map Picker Modal */}
      <LocationPickerModal
        visible={pickerVisible}
        title={pickerTarget === 'meeting' ? 'Select Meeting Point 📍' : 'Select Destination 🏁'}
        initialLat={
          pickerTarget === 'meeting'
            ? parseFloat(meetingLat) || 22.7196
            : parseFloat(destLat) || 23.2599
        }
        initialLng={
          pickerTarget === 'meeting'
            ? parseFloat(meetingLng) || 75.8577
            : parseFloat(destLng) || 77.4126
        }
        initialName={pickerTarget === 'meeting' ? meetingName : destName}
        onSelect={handleLocationPicked}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 20, paddingBottom: 40 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  hint: { fontSize: 13, color: '#888', marginBottom: 10 },

  pickMapBtn: {
    backgroundColor: '#fff8f3',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickMapBtnDest: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  pickMapBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#1a1a1a',
    backgroundColor: '#fff', marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  tip: {
    backgroundColor: '#fff8f3', borderRadius: 10, padding: 14,
    marginVertical: 18, borderLeftWidth: 4, borderLeftColor: '#FF6B35',
  },
  tipText: { fontSize: 13, color: '#666', lineHeight: 20 },

  createBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
