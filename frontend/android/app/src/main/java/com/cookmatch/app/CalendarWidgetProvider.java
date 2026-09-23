package com.cookmatch.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * 홈 화면 **요리 캘린더 위젯** — 보기 전용. 두 크기를 같은 코드로 그린다.
 *
 *   4×2([CalendarWidgetProvider])       왼쪽 달력 + 오른쪽 목표 카드(게이지·달성·절약액)
 *   4×3([CalendarBigWidgetProvider])    목표 카드 + 달력 + 식구 범례 + 「오늘」·「내일」 목록(늘리면 4×4)
 *
 * 앱 마이캘린더 화면과 **같은 표식**을 쓴다:
 *   · 완료한 날 — 그 요리를 한 사람의 색 점(여러 명이면 점이 여러 개, 3개까지만)
 *   · 계획한 날 — 빨간 펜으로 동그라미 친 표식(앱의 HandCircle 과 같은 획)
 *   · 오늘 — 옅은 테두리
 * 숫자를 눌러도 아무것도 바뀌지 않는다(삭제·목표 수정 같은 조작 없음). 누르면 앱의 요리 캘린더로 간다.
 *
 * 데이터: 앱이 요리 캘린더를 열 때 남긴 요약본(웹 `utils/widgetSnapshot.ts` → SharedPreferences
 * `CapacitorStorage` 의 `cookmatch_calendar`). 위젯은 앱과 다른 프로세스라 로그인 토큰을 쓸 수 없어
 * 서버를 직접 부르지 않는다 — 그래서 **앱을 연 시점 기준**이다.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    /** Capacitor Preferences 가 쓰는 SharedPreferences 이름과 키(웹 utils/widgetSnapshot.ts 와 한 쌍) */
    private static final String CAP_PREFS = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "cookmatch_calendar";

    private static final String CALENDAR_URI = "com.cookmatch.app://calendar";

    /** 4×2 의 날짜 칸·점·계획 동그라미 id */
    private static final int[] CELL_IDS = new int[42];
    private static final int[][] DOT_IDS = new int[42][3];
    private static final int[] PLAN_IDS = new int[42];
    /** 4×4 쪽 같은 것들 */
    private static final int[] BIG_CELL_IDS = new int[42];
    private static final int[][] BIG_DOT_IDS = new int[42][3];
    private static final int[] BIG_PLAN_IDS = new int[42];

    private static final int[] TODAY_ROW_IDS = { R.id.today_row_0, R.id.today_row_1, R.id.today_row_2 };
    private static final int[] TODAY_DOT_IDS = { R.id.today_dot_0, R.id.today_dot_1, R.id.today_dot_2 };
    private static final int[] TODAY_TEXT_IDS = { R.id.today_text_0, R.id.today_text_1, R.id.today_text_2 };
    private static final int[] TMR_ROW_IDS = { R.id.tmr_row_0, R.id.tmr_row_1, R.id.tmr_row_2 };
    private static final int[] TMR_DOT_IDS = { R.id.tmr_dot_0, R.id.tmr_dot_1, R.id.tmr_dot_2 };
    private static final int[] TMR_TEXT_IDS = { R.id.tmr_text_0, R.id.tmr_text_1, R.id.tmr_text_2 };

    private static final int[] LEGEND_IDS = { R.id.legend_0, R.id.legend_1, R.id.legend_2, R.id.legend_3 };
    private static final int[] LEGEND_DOT_IDS = { R.id.legend_dot_0, R.id.legend_dot_1, R.id.legend_dot_2, R.id.legend_dot_3 };
    private static final int[] LEGEND_TEXT_IDS = { R.id.legend_text_0, R.id.legend_text_1, R.id.legend_text_2, R.id.legend_text_3 };

    /** 4×4 하위 클래스가 덮어쓴다. */
    protected boolean isBig() {
        return false;
    }

    protected int layoutId() {
        return R.layout.widget_calendar;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    private void render(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());

        JSONObject days = null, snap = null;
        try {
            String raw = context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null);
            if (raw != null) {
                snap = new JSONObject(raw);
                days = snap.optJSONObject("days");
            }
        } catch (Exception ignored) {
            // 요약본이 없거나 깨졌으면 빈 달력을 그린다 — 앱을 한 번 열면 채워진다.
        }

        Calendar today = Calendar.getInstance();
        int year = today.get(Calendar.YEAR);
        int month = today.get(Calendar.MONTH) + 1;
        int done = snap == null ? 0 : snap.optInt("done", 0);
        Integer goal = (snap == null || snap.isNull("goal")) ? null : snap.optInt("goal");
        String prefix = isBig() ? "big" : "small";

        drawGrid(context, views, today, days);

        // 목표 카드 — 말은 앱 마이캘린더와 같게 쓴다(2026-09-23 지적: 앱에 없는 말을 새로 만들지 않는다)
        views.setTextViewText(res(prefix, "goal_title"),
                String.format(Locale.KOREA, "%d년 %d월 목표", year, month));
        views.setTextViewText(res(prefix, "goal_count"),
                goal != null ? String.format(Locale.KOREA, "목표 %d회", goal) : "목표 미설정");
        int pct = (goal == null || goal <= 0) ? 0 : Math.min(100, Math.round(done * 100f / goal));
        views.setProgressBar(res(prefix, "gauge"), 100, pct, false);
        views.setTextViewText(res(prefix, "progress_text"), goal != null
                ? String.format(Locale.KOREA, "%d회 / %d회 달성 (%d%%)", done, goal, pct)
                : String.format(Locale.KOREA, "%d회 완료", done));
        long savings = (snap == null || snap.isNull("goalSavings")) ? 0 : snap.optLong("goalSavings", 0);
        views.setTextViewText(res(prefix, "savings"), (goal != null && savings > 0)
                ? String.format(Locale.KOREA, "이번달 목표 %d회를 다 채우면 약 %,d원", goal, savings)
                : "앱에서 목표를 정하면 절약액을 계산해요");

        if (isBig()) {
            views.setTextViewText(R.id.big_cal_title, String.format(Locale.KOREA, "%d년 %d월", year, month));
            drawLegend(views, snap);
            drawDayList(views, snap, "today");
            drawDayList(views, snap, "tomorrow");
        } else {
            views.setTextViewText(R.id.calendar_title, String.format(Locale.KOREA, "%d년 %d월", year, month));
        }

        // 위젯 전체를 누르면 앱의 요리 캘린더로 — 위젯에서 할 수 있는 유일한 동작이다.
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse(CALENDAR_URI));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(isBig() ? R.id.big_root : R.id.small_root,
                PendingIntent.getActivity(context, widgetId * 10, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        manager.updateAppWidget(widgetId, views);
    }

    /** 달력 42칸: 날짜 숫자 + 사람 색 점 + 계획 동그라미 + 오늘 테두리 */
    private void drawGrid(Context context, RemoteViews views, Calendar today, JSONObject days) {
        int[] cells = isBig() ? BIG_CELL_IDS : CELL_IDS;
        int[][] dots = isBig() ? BIG_DOT_IDS : DOT_IDS;
        int[] plans = isBig() ? BIG_PLAN_IDS : PLAN_IDS;

        Calendar first = (Calendar) today.clone();
        first.set(Calendar.DAY_OF_MONTH, 1);
        int lead = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        int lastDay = today.getActualMaximum(Calendar.DAY_OF_MONTH);
        int todayDay = today.get(Calendar.DAY_OF_MONTH);
        String monthPrefix = String.format(Locale.KOREA, "%d-%02d-",
                today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1);

        for (int i = 0; i < cells.length; i++) {
            int dayNum = i - lead + 1;
            boolean inMonth = dayNum >= 1 && dayNum <= lastDay;

            if (!inMonth) {
                views.setTextViewText(cells[i], "");
                views.setInt(cells[i], "setBackgroundResource", 0);
                views.setViewVisibility(plans[i], View.GONE);
                for (int k = 0; k < 3; k++) views.setViewVisibility(dots[i][k], View.GONE);
                continue;
            }

            views.setTextViewText(cells[i], String.valueOf(dayNum));
            views.setTextColor(cells[i], context.getColor(
                    dayNum == todayDay ? R.color.widget_day_done_text : R.color.widget_label));
            views.setInt(cells[i], "setBackgroundResource",
                    dayNum == todayDay ? R.drawable.widget_day_today : 0);

            JSONObject cell = days == null ? null
                    : days.optJSONObject(monthPrefix + String.format(Locale.KOREA, "%02d", dayNum));
            JSONArray colors = cell == null ? null : cell.optJSONArray("dots");
            boolean planned = cell != null && cell.optBoolean("planned", false);

            views.setViewVisibility(plans[i], planned ? View.VISIBLE : View.GONE);

            int shown = colors == null ? 0 : Math.min(colors.length(), 3);
            for (int k = 0; k < 3; k++) {
                if (k < shown) {
                    views.setViewVisibility(dots[i][k], View.VISIBLE);
                    views.setInt(dots[i][k], "setColorFilter", parseColor(colors.optString(k), Color.GRAY));
                } else {
                    views.setViewVisibility(dots[i][k], View.GONE);
                }
            }
        }
    }

    /** 식구 범례 — 색·이름·횟수(많이 한 순서, 4명까지) */
    private void drawLegend(RemoteViews views, JSONObject snap) {
        JSONArray members = snap == null ? null : snap.optJSONArray("members");
        for (int i = 0; i < LEGEND_IDS.length; i++) {
            JSONObject m = members == null || i >= members.length() ? null : members.optJSONObject(i);
            if (m == null) {
                views.setViewVisibility(LEGEND_IDS[i], View.GONE);
                continue;
            }
            views.setViewVisibility(LEGEND_IDS[i], View.VISIBLE);
            views.setInt(LEGEND_DOT_IDS[i], "setColorFilter", parseColor(m.optString("color"), Color.GRAY));
            views.setTextViewText(LEGEND_TEXT_IDS[i],
                    String.format(Locale.KOREA, "%s %d", m.optString("name", "식구"), m.optInt("count", 0)));
        }
    }

    /**
     * 「오늘」·「내일」 목록(4×3 아래) — 레시피 제목을 **그대로** 보여 준다(요약하지 않는다).
     * 점 색은 마이캘린더 달력과 같은 사람 색이고, 계획은 속이 빈 동그라미, 완료는 꽉 찬 점이다.
     */
    private void drawDayList(RemoteViews views, JSONObject snap, String when) {
        boolean tomorrow = "tomorrow".equals(when);
        int[] rows = tomorrow ? TMR_ROW_IDS : TODAY_ROW_IDS;
        int[] dots = tomorrow ? TMR_DOT_IDS : TODAY_DOT_IDS;
        int[] texts = tomorrow ? TMR_TEXT_IDS : TODAY_TEXT_IDS;
        int emptyId = tomorrow ? R.id.tmr_empty : R.id.today_empty;

        JSONArray items = snap == null ? null : snap.optJSONArray("upcoming");
        int shown = 0;
        for (int i = 0; i < rows.length; i++) {
            JSONObject it = null;
            // 이 구간(오늘/내일)에 해당하는 것만 골라서 순서대로 채운다
            int seen = 0;
            for (int j = 0; items != null && j < items.length(); j++) {
                JSONObject cand = items.optJSONObject(j);
                if (cand == null || !when.equals(cand.optString("when"))) continue;
                if (seen++ == i) { it = cand; break; }
            }
            if (it == null) {
                views.setViewVisibility(rows[i], View.GONE);
                continue;
            }
            shown++;
            views.setViewVisibility(rows[i], View.VISIBLE);
            views.setImageViewResource(dots[i],
                    "plan".equals(it.optString("kind")) ? R.drawable.widget_dot_ring : R.drawable.widget_dot);
            views.setInt(dots[i], "setColorFilter", parseColor(it.optString("color"), Color.GRAY));
            views.setTextViewText(texts[i], it.optString("title", ""));
        }
        views.setViewVisibility(emptyId, shown == 0 ? View.VISIBLE : View.GONE);
    }

    /** 4×2 와 4×3 은 같은 이름의 뷰를 쓰되 id 앞머리만 다르다(small_/big_). */
    private int res(String prefix, String name) {
        if ("big".equals(prefix)) {
            switch (name) {
                case "goal_title": return R.id.big_goal_title;
                case "goal_count": return R.id.big_goal_count;
                case "gauge": return R.id.big_gauge;
                case "progress_text": return R.id.big_progress_text;
                default: return R.id.big_savings;
            }
        }
        switch (name) {
            case "goal_title": return R.id.small_goal_title;
            case "goal_count": return R.id.small_goal_count;
            case "gauge": return R.id.small_gauge;
            case "progress_text": return R.id.small_progress_text;
            default: return R.id.small_savings;
        }
    }

    private int parseColor(String value, int fallback) {
        try {
            return Color.parseColor(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    static {
        int[][] small = {
            { R.id.cell_0, R.id.plan_0, R.id.dot_0_0, R.id.dot_0_1, R.id.dot_0_2 },
            { R.id.cell_1, R.id.plan_1, R.id.dot_1_0, R.id.dot_1_1, R.id.dot_1_2 },
            { R.id.cell_2, R.id.plan_2, R.id.dot_2_0, R.id.dot_2_1, R.id.dot_2_2 },
            { R.id.cell_3, R.id.plan_3, R.id.dot_3_0, R.id.dot_3_1, R.id.dot_3_2 },
            { R.id.cell_4, R.id.plan_4, R.id.dot_4_0, R.id.dot_4_1, R.id.dot_4_2 },
            { R.id.cell_5, R.id.plan_5, R.id.dot_5_0, R.id.dot_5_1, R.id.dot_5_2 },
            { R.id.cell_6, R.id.plan_6, R.id.dot_6_0, R.id.dot_6_1, R.id.dot_6_2 },
            { R.id.cell_7, R.id.plan_7, R.id.dot_7_0, R.id.dot_7_1, R.id.dot_7_2 },
            { R.id.cell_8, R.id.plan_8, R.id.dot_8_0, R.id.dot_8_1, R.id.dot_8_2 },
            { R.id.cell_9, R.id.plan_9, R.id.dot_9_0, R.id.dot_9_1, R.id.dot_9_2 },
            { R.id.cell_10, R.id.plan_10, R.id.dot_10_0, R.id.dot_10_1, R.id.dot_10_2 },
            { R.id.cell_11, R.id.plan_11, R.id.dot_11_0, R.id.dot_11_1, R.id.dot_11_2 },
            { R.id.cell_12, R.id.plan_12, R.id.dot_12_0, R.id.dot_12_1, R.id.dot_12_2 },
            { R.id.cell_13, R.id.plan_13, R.id.dot_13_0, R.id.dot_13_1, R.id.dot_13_2 },
            { R.id.cell_14, R.id.plan_14, R.id.dot_14_0, R.id.dot_14_1, R.id.dot_14_2 },
            { R.id.cell_15, R.id.plan_15, R.id.dot_15_0, R.id.dot_15_1, R.id.dot_15_2 },
            { R.id.cell_16, R.id.plan_16, R.id.dot_16_0, R.id.dot_16_1, R.id.dot_16_2 },
            { R.id.cell_17, R.id.plan_17, R.id.dot_17_0, R.id.dot_17_1, R.id.dot_17_2 },
            { R.id.cell_18, R.id.plan_18, R.id.dot_18_0, R.id.dot_18_1, R.id.dot_18_2 },
            { R.id.cell_19, R.id.plan_19, R.id.dot_19_0, R.id.dot_19_1, R.id.dot_19_2 },
            { R.id.cell_20, R.id.plan_20, R.id.dot_20_0, R.id.dot_20_1, R.id.dot_20_2 },
            { R.id.cell_21, R.id.plan_21, R.id.dot_21_0, R.id.dot_21_1, R.id.dot_21_2 },
            { R.id.cell_22, R.id.plan_22, R.id.dot_22_0, R.id.dot_22_1, R.id.dot_22_2 },
            { R.id.cell_23, R.id.plan_23, R.id.dot_23_0, R.id.dot_23_1, R.id.dot_23_2 },
            { R.id.cell_24, R.id.plan_24, R.id.dot_24_0, R.id.dot_24_1, R.id.dot_24_2 },
            { R.id.cell_25, R.id.plan_25, R.id.dot_25_0, R.id.dot_25_1, R.id.dot_25_2 },
            { R.id.cell_26, R.id.plan_26, R.id.dot_26_0, R.id.dot_26_1, R.id.dot_26_2 },
            { R.id.cell_27, R.id.plan_27, R.id.dot_27_0, R.id.dot_27_1, R.id.dot_27_2 },
            { R.id.cell_28, R.id.plan_28, R.id.dot_28_0, R.id.dot_28_1, R.id.dot_28_2 },
            { R.id.cell_29, R.id.plan_29, R.id.dot_29_0, R.id.dot_29_1, R.id.dot_29_2 },
            { R.id.cell_30, R.id.plan_30, R.id.dot_30_0, R.id.dot_30_1, R.id.dot_30_2 },
            { R.id.cell_31, R.id.plan_31, R.id.dot_31_0, R.id.dot_31_1, R.id.dot_31_2 },
            { R.id.cell_32, R.id.plan_32, R.id.dot_32_0, R.id.dot_32_1, R.id.dot_32_2 },
            { R.id.cell_33, R.id.plan_33, R.id.dot_33_0, R.id.dot_33_1, R.id.dot_33_2 },
            { R.id.cell_34, R.id.plan_34, R.id.dot_34_0, R.id.dot_34_1, R.id.dot_34_2 },
            { R.id.cell_35, R.id.plan_35, R.id.dot_35_0, R.id.dot_35_1, R.id.dot_35_2 },
            { R.id.cell_36, R.id.plan_36, R.id.dot_36_0, R.id.dot_36_1, R.id.dot_36_2 },
            { R.id.cell_37, R.id.plan_37, R.id.dot_37_0, R.id.dot_37_1, R.id.dot_37_2 },
            { R.id.cell_38, R.id.plan_38, R.id.dot_38_0, R.id.dot_38_1, R.id.dot_38_2 },
            { R.id.cell_39, R.id.plan_39, R.id.dot_39_0, R.id.dot_39_1, R.id.dot_39_2 },
            { R.id.cell_40, R.id.plan_40, R.id.dot_40_0, R.id.dot_40_1, R.id.dot_40_2 },
            { R.id.cell_41, R.id.plan_41, R.id.dot_41_0, R.id.dot_41_1, R.id.dot_41_2 },
        };
        int[][] big = {
            { R.id.big_cell_0, R.id.big_plan_0, R.id.big_dot_0_0, R.id.big_dot_0_1, R.id.big_dot_0_2 },
            { R.id.big_cell_1, R.id.big_plan_1, R.id.big_dot_1_0, R.id.big_dot_1_1, R.id.big_dot_1_2 },
            { R.id.big_cell_2, R.id.big_plan_2, R.id.big_dot_2_0, R.id.big_dot_2_1, R.id.big_dot_2_2 },
            { R.id.big_cell_3, R.id.big_plan_3, R.id.big_dot_3_0, R.id.big_dot_3_1, R.id.big_dot_3_2 },
            { R.id.big_cell_4, R.id.big_plan_4, R.id.big_dot_4_0, R.id.big_dot_4_1, R.id.big_dot_4_2 },
            { R.id.big_cell_5, R.id.big_plan_5, R.id.big_dot_5_0, R.id.big_dot_5_1, R.id.big_dot_5_2 },
            { R.id.big_cell_6, R.id.big_plan_6, R.id.big_dot_6_0, R.id.big_dot_6_1, R.id.big_dot_6_2 },
            { R.id.big_cell_7, R.id.big_plan_7, R.id.big_dot_7_0, R.id.big_dot_7_1, R.id.big_dot_7_2 },
            { R.id.big_cell_8, R.id.big_plan_8, R.id.big_dot_8_0, R.id.big_dot_8_1, R.id.big_dot_8_2 },
            { R.id.big_cell_9, R.id.big_plan_9, R.id.big_dot_9_0, R.id.big_dot_9_1, R.id.big_dot_9_2 },
            { R.id.big_cell_10, R.id.big_plan_10, R.id.big_dot_10_0, R.id.big_dot_10_1, R.id.big_dot_10_2 },
            { R.id.big_cell_11, R.id.big_plan_11, R.id.big_dot_11_0, R.id.big_dot_11_1, R.id.big_dot_11_2 },
            { R.id.big_cell_12, R.id.big_plan_12, R.id.big_dot_12_0, R.id.big_dot_12_1, R.id.big_dot_12_2 },
            { R.id.big_cell_13, R.id.big_plan_13, R.id.big_dot_13_0, R.id.big_dot_13_1, R.id.big_dot_13_2 },
            { R.id.big_cell_14, R.id.big_plan_14, R.id.big_dot_14_0, R.id.big_dot_14_1, R.id.big_dot_14_2 },
            { R.id.big_cell_15, R.id.big_plan_15, R.id.big_dot_15_0, R.id.big_dot_15_1, R.id.big_dot_15_2 },
            { R.id.big_cell_16, R.id.big_plan_16, R.id.big_dot_16_0, R.id.big_dot_16_1, R.id.big_dot_16_2 },
            { R.id.big_cell_17, R.id.big_plan_17, R.id.big_dot_17_0, R.id.big_dot_17_1, R.id.big_dot_17_2 },
            { R.id.big_cell_18, R.id.big_plan_18, R.id.big_dot_18_0, R.id.big_dot_18_1, R.id.big_dot_18_2 },
            { R.id.big_cell_19, R.id.big_plan_19, R.id.big_dot_19_0, R.id.big_dot_19_1, R.id.big_dot_19_2 },
            { R.id.big_cell_20, R.id.big_plan_20, R.id.big_dot_20_0, R.id.big_dot_20_1, R.id.big_dot_20_2 },
            { R.id.big_cell_21, R.id.big_plan_21, R.id.big_dot_21_0, R.id.big_dot_21_1, R.id.big_dot_21_2 },
            { R.id.big_cell_22, R.id.big_plan_22, R.id.big_dot_22_0, R.id.big_dot_22_1, R.id.big_dot_22_2 },
            { R.id.big_cell_23, R.id.big_plan_23, R.id.big_dot_23_0, R.id.big_dot_23_1, R.id.big_dot_23_2 },
            { R.id.big_cell_24, R.id.big_plan_24, R.id.big_dot_24_0, R.id.big_dot_24_1, R.id.big_dot_24_2 },
            { R.id.big_cell_25, R.id.big_plan_25, R.id.big_dot_25_0, R.id.big_dot_25_1, R.id.big_dot_25_2 },
            { R.id.big_cell_26, R.id.big_plan_26, R.id.big_dot_26_0, R.id.big_dot_26_1, R.id.big_dot_26_2 },
            { R.id.big_cell_27, R.id.big_plan_27, R.id.big_dot_27_0, R.id.big_dot_27_1, R.id.big_dot_27_2 },
            { R.id.big_cell_28, R.id.big_plan_28, R.id.big_dot_28_0, R.id.big_dot_28_1, R.id.big_dot_28_2 },
            { R.id.big_cell_29, R.id.big_plan_29, R.id.big_dot_29_0, R.id.big_dot_29_1, R.id.big_dot_29_2 },
            { R.id.big_cell_30, R.id.big_plan_30, R.id.big_dot_30_0, R.id.big_dot_30_1, R.id.big_dot_30_2 },
            { R.id.big_cell_31, R.id.big_plan_31, R.id.big_dot_31_0, R.id.big_dot_31_1, R.id.big_dot_31_2 },
            { R.id.big_cell_32, R.id.big_plan_32, R.id.big_dot_32_0, R.id.big_dot_32_1, R.id.big_dot_32_2 },
            { R.id.big_cell_33, R.id.big_plan_33, R.id.big_dot_33_0, R.id.big_dot_33_1, R.id.big_dot_33_2 },
            { R.id.big_cell_34, R.id.big_plan_34, R.id.big_dot_34_0, R.id.big_dot_34_1, R.id.big_dot_34_2 },
            { R.id.big_cell_35, R.id.big_plan_35, R.id.big_dot_35_0, R.id.big_dot_35_1, R.id.big_dot_35_2 },
            { R.id.big_cell_36, R.id.big_plan_36, R.id.big_dot_36_0, R.id.big_dot_36_1, R.id.big_dot_36_2 },
            { R.id.big_cell_37, R.id.big_plan_37, R.id.big_dot_37_0, R.id.big_dot_37_1, R.id.big_dot_37_2 },
            { R.id.big_cell_38, R.id.big_plan_38, R.id.big_dot_38_0, R.id.big_dot_38_1, R.id.big_dot_38_2 },
            { R.id.big_cell_39, R.id.big_plan_39, R.id.big_dot_39_0, R.id.big_dot_39_1, R.id.big_dot_39_2 },
            { R.id.big_cell_40, R.id.big_plan_40, R.id.big_dot_40_0, R.id.big_dot_40_1, R.id.big_dot_40_2 },
            { R.id.big_cell_41, R.id.big_plan_41, R.id.big_dot_41_0, R.id.big_dot_41_1, R.id.big_dot_41_2 },
        };
        for (int i = 0; i < 42; i++) {
            CELL_IDS[i] = small[i][0];
            PLAN_IDS[i] = small[i][1];
            DOT_IDS[i][0] = small[i][2];
            DOT_IDS[i][1] = small[i][3];
            DOT_IDS[i][2] = small[i][4];
            BIG_CELL_IDS[i] = big[i][0];
            BIG_PLAN_IDS[i] = big[i][1];
            BIG_DOT_IDS[i][0] = big[i][2];
            BIG_DOT_IDS[i][1] = big[i][3];
            BIG_DOT_IDS[i][2] = big[i][4];
        }
    }
}
