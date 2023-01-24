"use strict";

/*
  Modified from the _compiled (js) and transpiled (gs) result_ of Code.ts:
    * More logging
    * Do not sync all-day events (usually these are vacations, best entered
      manually as "out of office" with message)
    * Do not sync events created by this script on other end
      (this is to support bidirectional sync)

    Note: Because some Google admins prevent sharing of the full event info
      from the calendar to outside, we use the event start time to mark
      creation by this script: the start time is set to one second later.
      Any event with non-zero seconds in the source calendar is discarded.

    Setup:
      1) In source calendar, go to "... Settings and sharing |
         Share with specific people or groups | + Add people and groups,
	 and add your target email address. Either 'See only free/busy'
	 or 'See all event details' will work.
      2) Open the email sent to the target address and click the link to
         add the calendar.
      3) Deploy: Rather than using 'clasp', go to https://script.google.com
         and create a new project. Paste this file into the code. Edit the
	 source and target "id" (just the email addresses is usually fine).
      4) Set the function to run as "main". Run it directly from there to test.
         Set "DELETE_ALL" true below to clear any changes made if needed.
      5) After satisfied, set up a trigger to run nightly, hourly, or however
         often is desired.
*/

// See: https://docs.simplecalendar.io/find-google-calendar-id
const SOURCE_CALENDAR_ID = "me@example.com";
const TARGET_CALENDAR_ID = "foobarbaz@group.calendar.google.com";

/* Set below to 'true' if you want to delete the events previous created by this
 * script. This is *only* going to delete the events created by this script, not
 * any others.
 */
const DELETE_ALL = false;

// no need to touch these
const TAG_NAME = "GCAL_I_AM_BUSY";
const TAG_VALUE = "yes";

// BEGIN CODE
const sourceCal = CalendarApp.getCalendarById(SOURCE_CALENDAR_ID);
if (sourceCal == null)
    throw "Unknown source calendar: " + SOURCE_CALENDAR_ID;
const targetCal = CalendarApp.getCalendarById(TARGET_CALENDAR_ID);
if (targetCal == null)
    throw "Unknown target calendar: " + TARGET_CALENDAR_ID;
const today = new Date();
const minDate = new Date();
minDate.setDate(today.getDate() - 7);
const maxDate = new Date();
maxDate.setDate(today.getDate() + 60);

function main() {
    const sourceEvents = (function () {
        var evs = [];
        sourceCal.getEvents(minDate, maxDate).map(function (ev) {
          const evStatus = ev.getMyStatus();
          return {
            "startTime": ev.getStartTime(),
            "endTime": ev.getEndTime(),
            "isAllDay" : ev.isAllDayEvent() || (ev.getEndTime().getTime() - ev.getStartTime().getTime()) >= 43200000,
            "isBusyEvent": (ev.getTag(TAG_NAME) == TAG_VALUE) || (ev.getTitle() == "Occupied"),
            "isAttending": evStatus == null || evStatus == CalendarApp.GuestStatus.YES || evStatus == CalendarApp.GuestStatus.OWNER,
        };
    }).forEach(function (ev) {
            const filtered = sourceFilter(ev);
            if (filtered != null)
                evs.push(filtered);
        });
        return evs;
    })();
    const targetEvents = (function () {
        const evs = targetCal.getEvents(minDate, maxDate)
            .filter(function (ev) {
            return ev.getTag(TAG_NAME) == TAG_VALUE;
        }).map(function (event) {
          var startTime = event.getStartTime();
          startTime.setSeconds(0); // clear marker so will match with incoming
           return {
            "startTime": startTime,
            "endTime": event.getEndTime(),
            "delete": event.deleteEvent,
        };
      });
      return evs;
    })();
    Logger.log("Found " + targetEvents.length + " events on the target calendar.");
    const mergedEvents = mergeOverlappingEvents(sourceEvents);
    Logger.log("Found " + sourceEvents.length + " events on the source calendar, " + mergedEvents.length + " after merge.");
    var _a = partitionEvents(mergedEvents, targetEvents), toInsert = _a[0], toDelete = _a[1];
    Logger.log("Found " + toInsert.length + " events to insert.");
    Logger.log("Found " + toDelete.length + " events to delete.");
    for (var _i = 0, toInsert_1 = toInsert; _i < toInsert_1.length; _i++) {
        const event = toInsert_1[_i];
        // set seconds so reverse sync can recognize this is a transferred event
        var startTime = event["startTime"];
        startTime.setTime(startTime.getTime() + 1000);
        Logger.log("Creating busy event starting at: " + startTime);
        const ev = targetCal.createEvent("Occupied", startTime, event["endTime"]);
        ev.setTag(TAG_NAME, TAG_VALUE);
        ev.removeAllReminders();
        Utilities.sleep(1000);
    }
    for (var _b = 0, toDelete_1 = toDelete; _b < toDelete_1.length; _b++) {
        var event = toDelete_1[_b];
        Logger.log("Deleting event starting at: " + event["startTime"]);
        try {
            event["delete"]();
        }
        catch (_c) {
            Logger.log("Couldn't delete an event, skipping");
        }
        Utilities.sleep(1000);
    }
    Logger.log("Done.");
}

function sourceFilter(ev) {
    if (DELETE_ALL)
        return null;
    else if (!ev["isAttending"])
        return null;
    // no need to preserve old events
    else if (ev["endTime"] < minDate)
        return null;
    // don't bring over vacations etc., let them be created separately
    else if (ev["isAllDay"])
        return null;
    // don't bring over events synced by us
    else if (ev["isBusyEvent"] || ev["startTime"].getSeconds() != 0)
      	return null;
    Logger.log("Passing source event at: " + ev["startTime"]);
    return ev;
}


var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};

function partitionEvents(sourceEvents, targetEvents) {
    var left = __spreadArray([], sourceEvents).sort(compareEvent);
    var right = __spreadArray([], targetEvents).sort(compareEvent);
    var onlyLeft = [];
    var onlyRight = [];
    while (left.length > 0 && right.length > 0) {
        if (left[0]["startTime"].getTime() == right[0]["startTime"].getTime()) {
            if (left[0]["endTime"].getTime() == right[0]["endTime"].getTime()) {
                left.shift();
                right.shift();
            }
            else if (left[0]["endTime"] < right[0]["endTime"]) {
                onlyLeft.push(left.shift());
            }
            else {
                onlyRight.push(right.shift());
            }
        }
        else if (left[0]["startTime"] < right[0]["startTime"]) {
            onlyLeft.push(left.shift());
        }
        else {
            onlyRight.push(right.shift());
        }
    }
    onlyLeft.push.apply(onlyLeft, left);
    onlyRight.push.apply(onlyRight, right);
    return [onlyLeft, onlyRight];
}
// Utils
function mergeOverlappingEvents(evs) {
    var sorted = __spreadArray([], evs).sort(compareEvent);
    var i = 0;
    while (i < sorted.length - 1) {
        // if the next event starts before this element finishes
        if (sorted[i]["endTime"] >= sorted[i + 1]["startTime"]) {
            // set the end time of this event to the later of two overlapping events
            sorted[i]["endTime"] = max(sorted[i]["endTime"], sorted[i + 1]["endTime"]);
            // delete the next event
            sorted.splice(i + 1, 1);
        }
        else {
            i++;
        }
    }
    return sorted;
}
function compareEvent(l, r) {
    if (l["startTime"] < r["startTime"])
        return -1;
    else if (l["startTime"] > r["startTime"])
        return 1;
    else if (l["endTime"] < r["endTime"])
        return -1;
    else if (l["endTime"] > r["endTime"])
        return 1;
    else
        return 0;
}
function max(l, r) {
    return l > r ? l : r;
}
