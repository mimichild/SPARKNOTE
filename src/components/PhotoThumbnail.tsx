import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import CameraIcon from './CameraIcon';

interface Props {
  uri?: string;
  size?: number;
}

export default function PhotoThumbnail({ uri, size = 52 }: Props) {
  if (uri) {
    return (
      <View style={[styles.photoBox, { width: size, height: size * (4 / 3) }]}>
        <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <CameraIcon color="#cbd5e1" size={size * 0.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  photoBox: {
    borderRadius: 10,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
