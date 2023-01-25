// Edit: https://docs.simplecalendar.io/find-google-calendar-id
const SOURCE_CALENDAR_ID = "me@example.com"
const TARGET_CALENDAR_ID = "foobarbaz@group.calendar.google.com"

/* Set below to 'true' if you want to delete the events previous created by this
 * script. This is *only* going to delete the events created by this script, not
 * any others. */
const DELETE_ALL = false


// no need to touch these
const TAG_NAME = "GCAL_I_AM_BUSY"
const TAG_VALUE = "yes"

// BEGIN CODE

type GDate = GoogleAppsScript.Base.Date

const sourceCal = CalendarApp.getCalendarById(SOURCE_CALENDAR_ID)
if(sourceCal == null) throw `Unknown source calendar: ${SOURCE_CALENDAR_ID}`

const targetCal = CalendarApp.getCalendarById(TARGET_CALENDAR_ID)
if(targetCal == null) throw `Unknown target calendar: ${TARGET_CALENDAR_ID}`

const today = new Date()

const minDate = new Date()
minDate.setDate(today.getDate() - 7)

const maxDate = new Date()
maxDate.setDate(today.getDate() + 60)

type Event = { "startTime": GDate, "endTime": GDate }
type SourceEvent = { "startTime": GDate, "endTime": GDate, "isAllDay": boolean,
		     "isBusyEvent": boolean, "isAttending": boolean }
type TargetEvent = { "startTime": GDate, "endTime": GDate, "delete": (() => void) }

function main() {
  Logger.log(`Considering date range ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}.`)
  const sourceEvents: SourceEvent[] = (() => {
    var evs: SourceEvent[] = []

    sourceCal.getEvents(minDate, maxDate).map(ev => {
      const evStatus = ev.getMyStatus()
      return {
      "startTime": ev.getStartTime(),
      "endTime": ev.getEndTime(),
      "isAllDay" : ev.isAllDayEvent() || (ev.getEndTime().getTime() - ev.getStartTime().getTime()) >= 43200000,
      "isBusyEvent" : (ev.getTag(TAG_NAME) == TAG_VALUE) || (ev.getTitle() == "Occupied"),
      "isAttending": evStatus == null || evStatus == CalendarApp.GuestStatus.YES || evStatus == CalendarApp.GuestStatus.OWNER,
    }}).forEach (ev => {
      const filtered = sourceFilter(ev)
      if (filtered != null) evs.push(filtered)
    })

    return evs
  }) ()

  const targetEvents: TargetEvent[] = (() => {
    const evs =
      targetCal.getEvents(minDate, maxDate)
        .filter(ev =>
           ev.getTag(TAG_NAME) == TAG_VALUE
        ).map(event => {
	  var startTime = event.getStartTime()
          startTime.setSeconds(0)  // clear marker so will match with incoming
	  return {
          "startTime": startTime,
          "endTime": event.getEndTime(),
          "delete": event.deleteEvent,
        }})
    return evs
  }) ()
  Logger.log(`Found ${targetEvents.length} events on the target calendar.`)

  const mergedEvents = mergeOverlappingEvents(sourceEvents)
  Logger.log(`Found ${sourceEvents.length} events on the source calendar, ${mergedEvents.length} after merge.`)
  const [toInsert, toDelete] = partitionEvents(mergedEvents, targetEvents)
  Logger.log(`Found ${toInsert.length} events to insert.`)
  Logger.log(`Found ${toDelete.length} events to delete.`)

  for(const event of toInsert) {
    // set seconds so reverse sync can recognize this is a transferred event
    var startTime = event["startTime"]
    startTime.setTime(startTime.getTime() + 1000)
    Logger.log(`Creating busy event starting at: ${startTime}`)
    const ev = targetCal.createEvent("Occupied", startTime, event["endTime"])
    ev.setTag(TAG_NAME, TAG_VALUE)
    ev.removeAllReminders()
    Utilities.sleep(1000)
  }
  for(const event of toDelete) {
    Logger.log(`Deleting event starting at: ${event["startTime"]}`)
    try {
      event["delete"]()
    } catch {
      Logger.log("Couldn't delete an event, skipping")
    }
    Utilities.sleep(1000)
  }

  Logger.log("Done.")
}

function sourceFilter(ev: SourceEvent): SourceEvent | null {
    if (DELETE_ALL)
        return null
    else if (!ev["isAttending"])
        return null
    // no need to preserve old events
    else if (ev["endTime"] < minDate)
        return null
    // don't bring over vacations etc., let them be created separately
    else if (ev["isAllDay"])
        return null
    // don't bring over events synced by us
    else if (ev["isBusyEvent"] || ev["startTime"].getSeconds() != 0)
        return null
    return ev
}

function partitionEvents(sourceEvents: SourceEvent[], targetEvents: TargetEvent[]): [SourceEvent[], TargetEvent[]] {
  let left = [...sourceEvents].sort(compareEvent)
  let right = [...targetEvents].sort(compareEvent)

  let onlyLeft: SourceEvent[] = []
  let onlyRight: TargetEvent[] = []

  while(left.length > 0 && right.length > 0) {
    if(left[0]["startTime"].getTime() == right[0]["startTime"].getTime()) {
      if(left[0]["endTime"].getTime() == right[0]["endTime"].getTime()) {
        left.shift()
        right.shift()
      } else if(left[0]["endTime"] < right[0]["endTime"]) {
        onlyLeft.push(left.shift()!)
      } else {
        onlyRight.push(right.shift()!)
      }
    } else if (left[0]["startTime"] < right[0]["startTime"]) {
       onlyLeft.push(left.shift()!)
    } else {
       onlyRight.push(right.shift()!)
    }
  }

  onlyLeft.push(...left)
  onlyRight.push(...right)

  return [onlyLeft, onlyRight]
}

// Utils

function mergeOverlappingEvents(evs: SourceEvent[]): SourceEvent[] {
    var sorted = [...evs].sort(compareEvent)

    var i = 0
    while(i < sorted.length - 1) {
      // if the next event starts before this element finishes
      if(sorted[i]["endTime"] >= sorted[i+1]["startTime"]) {
        // set the end time of this event to the later of two overlapping events
        sorted[i]["endTime"] = max(sorted[i]["endTime"], sorted[i+1]["endTime"])
        // delete the next event
        sorted.splice(i+1, 1)
      } else {
        i++
      }
    }

    return sorted
}

function compareEvent(l: Event, r: Event) {
  if(l["startTime"] < r["startTime"]) return -1
  else if(l["startTime"] > r["startTime"]) return 1
  else if(l["endTime"] < r["endTime"]) return -1
  else if(l["endTime"] > r["endTime"]) return 1
  else return 0
}


function max<T>(l: T, r: T): T {
    return l > r ? l : r
}
