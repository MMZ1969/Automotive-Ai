import React, { useState, useEffect } from 'react';
import { Button, Image, View, ScrollView, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { storage } from './firebaseConfig';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from 'firebase/storage';

export default function App() {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState(null);
  const [allUrls, setAllUrls] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
      }
    })();
  }, []);

  const handleImage = async (pickerResult) => {
    if (!pickerResult.canceled) {
      const uri = pickerResult.assets[0].uri;
      setImage(uri);
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.split('/').pop();
      const imageRef = ref(storage, `images/${filename}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      setUrl(downloadURL);
      console.log('Uploaded to:', downloadURL);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    handleImage(result);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    handleImage(result);
  };

  const fetchAllImages = async () => {
    const imagesRef = ref(storage, 'images/');
    const result = await listAll(imagesRef);
    const urls = await Promise.all(
      result.items.map((itemRef) => getDownloadURL(itemRef))
    );
    setAllUrls(urls);
  };

  const deleteImage = async (url) => {
    try {
      const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
      const imageRef = ref(storage, path);
      await deleteObject(imageRef);
      setAllUrls((prev) => prev.filter((u) => u !== url));
      Alert.alert('Deleted', 'Image has been deleted.');
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Could not delete image.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Pick from Gallery" onPress={pickFromGallery} />
      <View style={{ margin: 10 }} />
      <Button title="Take a Photo" onPress={takePhoto} />
      <View style={{ margin: 10 }} />
      <Button title="Show All Uploaded Images" onPress={fetchAllImages} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      {url && <Button title="View Uploaded Image" onPress={() => alert(url)} />}
      {allUrls.map((u, i) => (
        <View key={i} style={styles.imageBlock}>
          <Image source={{ uri: u }} style={styles.image} />
          <Button title="Delete" color="red" onPress={() => deleteImage(u)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40 },
  image: { width: 200, height: 200, marginTop: 20 },
  imageBlock: { alignItems: 'center', marginTop: 20 },
});
