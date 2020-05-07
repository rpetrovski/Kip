import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { isNull } from 'util';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
}
/**
 * SignalK Notification Object interface.
 */
interface SignalKNotification {
  state: string;
  message: string;
  method: string[];
  ack?: boolean;
}
/**
 * Array of active alarms. Contains alarm paths and SignalK notification object details
 */
export interface ActiveAlarms {
  [path: string]: SignalKNotification;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  notificationsSubject: Subject<AppNotification> = new Subject<AppNotification>();
  activeAlarmsSubject: BehaviorSubject<ActiveAlarms> = new BehaviorSubject<ActiveAlarms>({});

  activeAlarms: ActiveAlarms = {};

  constructor() { }
  /**
 * Display Kip Snackbar notification.
 * @param message Text to be displayed.
 * @param duration Display duration in milliseconds before automatic dismissal. Duration value of 0 is indefinite or until use clicks Dismiss button. Defaults to 10000 of no value is provided.
 */
  newNotification(message: string, duration: number = 10000) {
    console.log(message);

    this.notificationsSubject.next({ message: message, duration: duration});
  }

  getNotificationObservable() {
    return this.notificationsSubject.asObservable();
  }
  getAlarmObservable() {
    return this.activeAlarmsSubject.asObservable();
  }
/**
 * Send SignalK Delta update to Kip Notification system to process Alarms and Notifications.
 * @param path path of Notification message
 * @param notificationValue Content of the message. Must conform to SignalKNotification interface.
 */
  public processNotificationDelta(path: string, notificationValue: SignalKNotification) {
    if (isNull(notificationValue)) {
      // erase any alarms with path
      if (path in this.activeAlarms) {
        delete this.activeAlarms[path];
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    } else {
      if (path in this.activeAlarms) {
        //already know of this alarm. Just check if updated (no need to update doc/etc if no change)
        if (    (this.activeAlarms[path].state != notificationValue.state)
              ||(this.activeAlarms[path].message != notificationValue.message)
              ||(JSON.stringify(this.activeAlarms[path].method) != JSON.stringify(notificationValue.method)) ) { // no easy way to compare arrays??? ok...
          this.activeAlarms[path] = notificationValue;
          this.activeAlarmsSubject.next(this.activeAlarms);

        }
      } else {
        // new alarm, add it
        this.activeAlarms[path] = notificationValue;
        this.activeAlarmsSubject.next(this.activeAlarms);
      }
    }
  }
/**
 * Clears all Kip Notification Alarm system (internal array and Observers).
 * Used when server connection need to be reset and the Kip state restored fresh.
 */
  public resetAlarms() {
    this.activeAlarms = {};
    this.activeAlarmsSubject.next(this.activeAlarms);
  }

}
