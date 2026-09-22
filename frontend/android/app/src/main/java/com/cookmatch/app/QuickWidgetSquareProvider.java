package com.cookmatch.app;

/**
 * 홈 화면 위젯 2×2(정사각형). 버튼과 색은 가로형([QuickWidgetProvider])과 같고 배치만 다르다 —
 * 윗줄에 「요리 AI」를 가로로 긴 알약으로, 아랫줄에 재료 찍기·AI 식단. 홈 화면 배치에 따라 가로 3칸이
 * 안 나오는 경우가 있어 두 모양을 다 제공하고 사용자가 고르게 한다(2026-09-23 요청).
 */
public class QuickWidgetSquareProvider extends QuickWidgetProvider {

    @Override
    protected int layoutId() {
        return R.layout.widget_quick_square;
    }
}
