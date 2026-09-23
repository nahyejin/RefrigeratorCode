package com.cookmatch.app;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * 앱 화면(웹뷰) 글자 확대의 상한 — 휴대폰 "글꼴 크기" 설정 배율 기준.
     *
     * 안드로이드 웹뷰는 휴대폰 글꼴 크기 설정을 그대로 따라 글자를 키운다. 어르신 폰처럼 글꼴을
     * 최대(2배)로 키워 두면 버튼 글자가 줄바꿈되고, 하단 메뉴 이름이 겹치고, 챗봇 입력창을 쓰기
     * 어려워졌다(실사용 지적, 2026-09-21). 가상 폰에서 배율별로 확인해 보니 1.3배까지는 화면이
     * 그대로 유지되고 1.5배부터 제목·드롭다운·하단 메뉴가 깨졌다 — 그래서 1.3배를 상한으로 둔다.
     *   - 기본 글꼴(1.0) 사용자: 아무것도 달라지지 않는다(그대로 100%).
     *   - 1.3배 이하로 키운 사람: 설정한 만큼 그대로 커진다.
     *   - 그보다 크게 키운 사람: 1.3배로 보인다(여전히 기본보다 크게, 화면은 안 깨지게).
     * iOS 웹뷰는 원래 휴대폰 글꼴 설정을 따르지 않아 해당 없음.
     */
    private static final float MAX_FONT_SCALE = 1.3f;

    @Override
    public void onResume() {
        super.onResume();
        // 앱을 쓰다가 휴대폰 설정에서 글꼴 크기를 바꾸고 돌아와도 다시 맞도록 돌아올 때마다 적용
        applyTextZoomCap();
    }

    /**
     * 앱이 화면에서 빠질 때(홈으로 나가기·다른 앱으로 전환) 마이캘린더 위젯을 다시 그린다.
     * 위젯은 앱이 남긴 요약본만 읽는데, 요약본을 새로 쓰거나(마이캘린더를 봄) 지워도(로그아웃)
     * 위젯은 스스로 알 길이 없어 30분 주기 갱신까지 옛 그림이 남았다(2026-09-23).
     */
    @Override
    public void onPause() {
        super.onPause();
        CalendarWidgetProvider.refreshAll(this);
    }

    private void applyTextZoomCap() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        float scale = getResources().getConfiguration().fontScale;
        webView.getSettings().setTextZoom(Math.round(Math.min(scale, MAX_FONT_SCALE) * 100));
    }
}
