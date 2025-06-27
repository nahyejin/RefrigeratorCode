import React from 'react';
import { YoutubeLogoSVG, NaverLogoSVG } from '../components/LogoSVGs';
import naverLogo from '../assets/썸네일_naverlogo.png';
import youtubeLogo from '../assets/썸네일_youtubelogo.png';

// =====================
// 상수
// =====================

const PLATFORMS = {
  WEB: 'web',
  MOBILE: 'mobile',
} as const;

const MOBILE_BREAKPOINT = 768;

// =====================
// 타입 정의
// =====================

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

// =====================
// 유틸리티 함수
// =====================

/**
 * 현재 화면 너비가 모바일 기준인지 확인
 */
function isMobileScreen(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

/**
 * 사용자 에이전트가 모바일 기기인지 확인
 */
function isMobileUserAgent(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
}

// =====================
// 메인 함수
// =====================

/**
 * 현재 플랫폼을 감지하여 반환한다.
 */
export function detectPlatform(): Platform {
  if (isMobileScreen() || isMobileUserAgent()) {
    return PLATFORMS.MOBILE;
  }
  return PLATFORMS.WEB;
}

/**
 * 현재 플랫폼이 모바일인지 확인한다.
 */
export function isMobile(): boolean {
  return detectPlatform() === PLATFORMS.MOBILE;
}

/**
 * 현재 플랫폼이 웹인지 확인한다.
 */
export function isWeb(): boolean {
  return detectPlatform() === PLATFORMS.WEB;
}

export const getPlatformLogo = (platform: string | undefined) => {
  if (!platform) return null;
  const lower = platform.toLowerCase();
  if (lower.includes('naver') || platform.includes('네이버')) return naverLogo;
  if (lower.includes('youtube') || platform.includes('유튜브')) return youtubeLogo;
  return null;
}; 