import React from 'react';
import { YoutubeLogoSVG, NaverLogoSVG } from '../components/LogoSVGs';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

export const getPlatformLogo = (platform: string | undefined) => {
  if (!platform) return null;
  const lower = platform.toLowerCase();
  if (lower.includes('naver') || platform.includes('네이버')) return naverLogo;
  if (lower.includes('youtube') || platform.includes('유튜브')) return youtubeLogo;
  return null;
}; 