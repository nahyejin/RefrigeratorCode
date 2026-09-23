package com.cookmatch.app;

/**
 * 홈 화면 요리 캘린더 위젯 **4×4**. 그리는 규칙은 [CalendarWidgetProvider] 와 같고
 * 레이아웃만 큰 것을 쓴다 — 목표 게이지·큰 달력·식구 범례가 함께 들어간다(2026-09-23 요청).
 * 4×2 는 달력 + 오늘·내일 목록만 보여 준다.
 */
public class CalendarBigWidgetProvider extends CalendarWidgetProvider {

    @Override
    protected boolean isBig() {
        return true;
    }

    @Override
    protected int layoutId() {
        return R.layout.widget_calendar_big;
    }
}
