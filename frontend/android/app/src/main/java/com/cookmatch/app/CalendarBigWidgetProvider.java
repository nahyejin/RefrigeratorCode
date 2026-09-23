package com.cookmatch.app;

/**
 * 홈 화면 마이캘린더 위젯 **4×3**(늘리면 4×4). 그리는 규칙은 [CalendarWidgetProvider] 와 같고
 * 레이아웃만 큰 것을 쓴다 — 목표·범례 + 달력 + 「오늘」·「내일」 목록.
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
