use std::{
  collections::HashSet,
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime, State};
use tauri_plugin_notification::NotificationExt;

const EVENT_WINDOW_MS: i64 = 1_150;
const TICK_MS: u64 = 500;

#[derive(Debug, Clone, Default)]
pub struct RuntimeSchedulerState {
  inner: Arc<Mutex<SchedulerSnapshot>>,
}

#[derive(Debug, Default)]
struct SchedulerSnapshot {
  events: Vec<RuntimeScheduledEvent>,
  fired: HashSet<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSchedulePayload {
  pub events: Vec<RuntimeScheduledEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeScheduledEvent {
  pub id: String,
  pub prayer: Option<String>,
  pub at_ms: i64,
  pub title: String,
  pub body: String,
  pub play_sound: bool,
  pub sound: Option<String>,
  pub play_full_adhan: bool,
  pub start_focus: bool,
}

pub fn init_scheduler<R: Runtime>(app: AppHandle<R>) -> RuntimeSchedulerState {
  let state = RuntimeSchedulerState::default();
  let shared = state.inner.clone();
  thread::spawn(move || loop {
    process_scheduler_tick(&app, &shared);
    thread::sleep(Duration::from_millis(TICK_MS));
  });
  state
}

pub fn sync_runtime_schedule(
  state: State<'_, RuntimeSchedulerState>,
  payload: RuntimeSchedulePayload,
) -> Result<(), String> {
  let mut snapshot = state.inner.lock().map_err(|err| err.to_string())?;
  let active_ids: HashSet<String> = payload.events.iter().map(|event| event.id.clone()).collect();
  snapshot.fired.retain(|id| active_ids.contains(id));
  snapshot.events = payload.events;
  Ok(())
}

fn process_scheduler_tick<R: Runtime>(app: &AppHandle<R>, shared: &Arc<Mutex<SchedulerSnapshot>>) {
  let now_ms = now_ms();
  let due_events = {
    let mut snapshot = match shared.lock() {
      Ok(snapshot) => snapshot,
      Err(_) => return,
    };
    let events = snapshot.events.clone();

    snapshot.fired.retain(|id| {
      events
        .iter()
        .find(|event| &event.id == id)
        .map(|event| event.at_ms > now_ms - 3_600_000)
        .unwrap_or(false)
    });

    let mut due = Vec::new();
    for event in events {
      if snapshot.fired.contains(&event.id) {
        continue;
      }
      if (now_ms - event.at_ms).abs() <= EVENT_WINDOW_MS {
        snapshot.fired.insert(event.id.clone());
        due.push(event);
      }
    }
    due
  };

  for event in due_events {
    if event.start_focus {
      let _ = app.emit("prayer-runtime-event", &event);
      continue;
    }

    let _ = app
      .notification()
      .builder()
      .title(event.title.clone())
      .body(event.body.clone())
      .show();
    let _ = app.emit("prayer-runtime-event", &event);
  }
}

fn now_ms() -> i64 {
  use std::time::{SystemTime, UNIX_EPOCH};

  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as i64)
    .unwrap_or_default()
}
