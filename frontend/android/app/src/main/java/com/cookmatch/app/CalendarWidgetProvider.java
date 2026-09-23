package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * 홈 화면 **요리 캘린더 위젯**(4×2) — 보기 전용.
 *
 * 무엇을 보여 주나:
 *   이번 달(또는 이번 주/오늘) 며칠에 몇 번 요리했는지. 숫자를 누르거나 길게 눌러도 **아무것도 바뀌지 않는다**
 *   — 삭제·즐겨찾기 해제 같은 조작은 넣지 않는다(2026-09-23 요청). 유일한 동작은 ① 위젯을 누르면 앱의
 *   요리 캘린더로 가는 것 ② 상단 「일·주·월」로 보는 범위를 바꾸는 것뿐이다.
 *
 * 데이터를 어디서 읽나:
 *   앱이 요리 캘린더 화면을 열 때마다 요약본을 기기에 남긴다(웹 `utils/widgetSnapshot.ts` →
 *   Capacitor Preferences → SharedPreferences `CapacitorStorage` 의 `cookmatch_calendar`).
 *   위젯은 그 JSON 만 읽는다. 위젯이 서버를 직접 부르려면 로그인 토큰을 프로세스 밖으로 꺼내야 하는데,
 *   "이 달에 며칠 요리했나"를 보여 주자고 토큰을 복사해 두는 것은 얻는 것보다 위험이 크다.
 *   그래서 **앱을 연 시점 기준**이고, 위젯에도 그 시각을 적어 둔다.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    /** Capacitor Preferences 가 쓰는 SharedPreferences 이름과 키(웹 utils/widgetSnapshot.ts 와 한 쌍) */
    private static final String CAP_PREFS = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "cookmatch_calendar";

    /** 위젯마다 고른 보기 범위를 저장해 둔다(위젯 자체 설정이라 앱 데이터와 섞지 않는다) */
    private static final String WIDGET_PREFS = "cookmatch_calendar_widget";
    private static final String ACTION_SET_MODE = "kr.cookmatch.app.CALENDAR_WIDGET_MODE";
    private static final String EXTRA_MODE = "mode";

    private static final String MODE_DAY = "day";
    private static final String MODE_WEEK = "week";
    private static final String MODE_MONTH = "month";

    private static final String CALENDAR_URI = "com.cookmatch.app://calendar";

    /** 날짜 칸 id — 6주 × 7일. RemoteViews 는 코드로 뷰를 못 만들어서 레이아웃에 미리 42칸을 둔다. */
    private static final int[] CELL_IDS = new int[42];

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_SET_MODE.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            String mode = intent.getStringExtra(EXTRA_MODE);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID && mode != null) {
                context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
                        .edit().putString(String.valueOf(id), mode).apply();
                render(context, AppWidgetManager.getInstance(context), id);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor e = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) e.remove(String.valueOf(id));
        e.apply();
    }

    private void render(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        String mode = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
                .getString(String.valueOf(widgetId), MODE_MONTH);

        JSONObject days = null;
        int done = 0;
        Integer goal = null;
        try {
            String raw = context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null);
            if (raw != null) {
                JSONObject snap = new JSONObject(raw);
                days = snap.optJSONObject("days");
                done = snap.optInt("done", 0);
                if (!snap.isNull("goal")) goal = snap.optInt("goal");
            }
        } catch (Exception ignored) {
            // 요약본이 없거나 깨졌으면 빈 달력을 그린다 — 앱을 한 번 열면 채워진다.
        }

        Calendar today = Calendar.getInstance();
        views.setTextViewText(R.id.calendar_title, String.format(Locale.KOREA, "%d월 요리",
                today.get(Calendar.MONTH) + 1));
        views.setTextViewText(R.id.calendar_summary, goal != null
                ? String.format(Locale.KOREA, "%d / %d회", done, goal)
                : String.format(Locale.KOREA, "%d회", done));

        drawCells(context, views, mode, today, days);
        markSelectedMode(views, mode);

        // 보기 전환 버튼 — 위젯 안에서만 바뀌고 앱 데이터는 건드리지 않는다.
        views.setOnClickPendingIntent(R.id.calendar_mode_day, modeIntent(context, widgetId, MODE_DAY));
        views.setOnClickPendingIntent(R.id.calendar_mode_week, modeIntent(context, widgetId, MODE_WEEK));
        views.setOnClickPendingIntent(R.id.calendar_mode_month, modeIntent(context, widgetId, MODE_MONTH));

        // 달력 부분을 누르면 앱의 요리 캘린더로 — 위젯에서 할 수 있는 유일한 "조작"이다.
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse(CALENDAR_URI));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.calendar_grid, PendingIntent.getActivity(
                context, widgetId * 10, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        manager.updateAppWidget(widgetId, views);
    }

    private PendingIntent modeIntent(Context context, int widgetId, String mode) {
        Intent intent = new Intent(context, CalendarWidgetProvider.class);
        intent.setAction(ACTION_SET_MODE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        intent.putExtra(EXTRA_MODE, mode);
        // 같은 위젯의 세 버튼이 서로 다른 PendingIntent 가 되도록 requestCode 를 다르게 준다.
        int code = widgetId * 10 + (MODE_DAY.equals(mode) ? 1 : MODE_WEEK.equals(mode) ? 2 : 3);
        return PendingIntent.getBroadcast(context, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * 42칸을 채운다.
     *   월: 이 달 1일부터 말일까지(앞뒤 빈칸)
     *   주: 이번 주 일~토를 **첫 줄에** 모아서
     *   일: 오늘 한 칸만, 요일 머리글과 같은 열에
     */
    private void drawCells(Context context, RemoteViews views, String mode, Calendar today, JSONObject days) {
        Calendar first = (Calendar) today.clone();
        first.set(Calendar.DAY_OF_MONTH, 1);
        int lead = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY; // 1일이 무슨 요일인지
        int lastDay = today.getActualMaximum(Calendar.DAY_OF_MONTH);
        int todayDay = today.get(Calendar.DAY_OF_MONTH);
        int weekStart = todayDay - (today.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY); // 이번 주 일요일

        // 칸 번호 → 그 칸에 그릴 날짜(0이면 빈 칸).
        // 주·일 보기에서는 **첫 줄에** 모아 그린다 — 달력 위치 그대로 두면 위쪽이 텅 비어 보인다(2026-09-23).
        int[] dayOfCell = new int[CELL_IDS.length];
        if (MODE_MONTH.equals(mode)) {
            for (int i = 0; i < CELL_IDS.length; i++) {
                int d = i - lead + 1;
                dayOfCell[i] = (d >= 1 && d <= lastDay) ? d : 0;
            }
        } else if (MODE_WEEK.equals(mode)) {
            for (int c = 0; c < 7; c++) {
                int d = weekStart + c;
                dayOfCell[c] = (d >= 1 && d <= lastDay) ? d : 0;
            }
        } else { // 일: 오늘 하나만, 오늘 요일 자리에 둔다(요일 머리글과 줄을 맞추려고)
            dayOfCell[today.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY] = todayDay;
        }

        String monthPrefix = String.format(Locale.KOREA, "%d-%02d-", today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1);

        for (int i = 0; i < CELL_IDS.length; i++) {
            int cellId = CELL_IDS[i];
            int dayNum = dayOfCell[i];
            if (dayNum == 0) {
                views.setTextViewText(cellId, "");
                views.setInt(cellId, "setBackgroundResource", 0);
                continue;
            }

            int count = days == null ? 0
                    : days.optInt(monthPrefix + String.format(Locale.KOREA, "%02d", dayNum), 0);

            views.setTextViewText(cellId, String.valueOf(dayNum));
            // 요리한 날은 노란 동그라미, 오늘은 테두리, 나머지는 배경 없음.
            if (count > 0) {
                views.setInt(cellId, "setBackgroundResource", R.drawable.widget_day_done);
                views.setTextColor(cellId, context.getColor(R.color.widget_day_done_text));
            } else if (dayNum == todayDay) {
                views.setInt(cellId, "setBackgroundResource", R.drawable.widget_day_today);
                views.setTextColor(cellId, context.getColor(R.color.widget_icon));
            } else {
                views.setInt(cellId, "setBackgroundResource", 0);
                views.setTextColor(cellId, context.getColor(R.color.widget_label));
            }
        }
    }

    /** 고른 보기 버튼만 진하게 */
    private void markSelectedMode(RemoteViews views, String mode) {
        int[] ids = { R.id.calendar_mode_day, R.id.calendar_mode_week, R.id.calendar_mode_month };
        String[] modes = { MODE_DAY, MODE_WEEK, MODE_MONTH };
        for (int i = 0; i < ids.length; i++) {
            boolean on = modes[i].equals(mode);
            views.setInt(ids[i], "setBackgroundResource", on ? R.drawable.widget_mode_on : R.drawable.widget_mode_off);
        }
    }

    static {
        // R.id.cell_0 ~ cell_41 을 순서대로 담는다(레이아웃에 같은 이름으로 42개가 있다).
        CELL_IDS[0] = R.id.cell_0;   CELL_IDS[1] = R.id.cell_1;   CELL_IDS[2] = R.id.cell_2;
        CELL_IDS[3] = R.id.cell_3;   CELL_IDS[4] = R.id.cell_4;   CELL_IDS[5] = R.id.cell_5;
        CELL_IDS[6] = R.id.cell_6;   CELL_IDS[7] = R.id.cell_7;   CELL_IDS[8] = R.id.cell_8;
        CELL_IDS[9] = R.id.cell_9;   CELL_IDS[10] = R.id.cell_10; CELL_IDS[11] = R.id.cell_11;
        CELL_IDS[12] = R.id.cell_12; CELL_IDS[13] = R.id.cell_13; CELL_IDS[14] = R.id.cell_14;
        CELL_IDS[15] = R.id.cell_15; CELL_IDS[16] = R.id.cell_16; CELL_IDS[17] = R.id.cell_17;
        CELL_IDS[18] = R.id.cell_18; CELL_IDS[19] = R.id.cell_19; CELL_IDS[20] = R.id.cell_20;
        CELL_IDS[21] = R.id.cell_21; CELL_IDS[22] = R.id.cell_22; CELL_IDS[23] = R.id.cell_23;
        CELL_IDS[24] = R.id.cell_24; CELL_IDS[25] = R.id.cell_25; CELL_IDS[26] = R.id.cell_26;
        CELL_IDS[27] = R.id.cell_27; CELL_IDS[28] = R.id.cell_28; CELL_IDS[29] = R.id.cell_29;
        CELL_IDS[30] = R.id.cell_30; CELL_IDS[31] = R.id.cell_31; CELL_IDS[32] = R.id.cell_32;
        CELL_IDS[33] = R.id.cell_33; CELL_IDS[34] = R.id.cell_34; CELL_IDS[35] = R.id.cell_35;
        CELL_IDS[36] = R.id.cell_36; CELL_IDS[37] = R.id.cell_37; CELL_IDS[38] = R.id.cell_38;
        CELL_IDS[39] = R.id.cell_39; CELL_IDS[40] = R.id.cell_40; CELL_IDS[41] = R.id.cell_41;
    }
}
