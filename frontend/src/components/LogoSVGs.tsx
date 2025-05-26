import React from 'react';

export const YoutubeLogoSVG = ({ size = 24 }) => (
  <svg viewBox="0 0 90 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="90" height="64" rx="12" fill="#FF0000"/>
    <polygon points="36,20 36,44 60,32" fill="#fff"/>
  </svg>
);

export const NaverLogoSVG = ({ size = 24 }) => (
  <svg viewBox="0 0 512 512" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#03CF5D"/>
    <path d="M 144 128 H 224 L 288 224 V 128 H 368 V 384 H 288 L 224 288 V 384 H 144 V 128 Z" fill="#fff"/>
  </svg>
); 