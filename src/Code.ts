// To find your calendar id, see: https://docs.simplecalendar.io/find-google-calendar-id
const SOURCE_CALENDAR_ID = "me@example.com"
const TARGET_CALENDAR_ID = "foobarbaz@group.calendar.google.com"

const TAG_NAME = "GCAL_I_AM_BUSY"
const TAG_VALUE = "yes"

// BEGIN CODE

const sourceCal = CalendarApp.getCalendarById(SOURCE_CALENDAR_ID)
if(sourceCal == null) throw `Unknown source calendar: ${SOURCE_CALENDAR_ID}`

const targetCal = CalendarApp.getCalendarById(TARGET_CALENDAR_ID)
if(targetCal == null) throw `Unknown target calendar: ${TARGET_CALENDAR_ID}`

const today = new Date()

const yesterday = new Date()
yesterday.setDate(today.getDate() - 1)

const minDate = new Date()
minDate.setDate(today.getDate() - 15)

const maxDate = new Date()
maxDate.setDate(today.getDate() + 60)

function transform(ev: Event): Event | null {
  // no need to preserve old events
  if(ev["endTime"] < yesterday) return null
  return ev
}

type Event = { "startTime": Date, "endTime": Date }
type ExistingEvent = { "startTime": Date, "endTime": Date, "delete": (() => void) }

function main() {
  const sourceEvents: Event[] = (() => {
    const evs: Event[] = []

    sourceCal.getEvents(minDate, maxDate).map(ev => ({
      "startTime": ev.getStartTime(),
      "endTime": ev.getEndTime()
    })).forEach (ev => {
      const r = transform(ev)
      if (r != null) evs.push(r)
    })

    return evs
  }) ()
  Logger.log(`Found ${sourceEvents.length} events on the source calendar.`)

  const existingEvents: ExistingEvent[] = (() => {
    const evs =
      targetCal.getEvents(minDate, maxDate)
        .filter(ev =>
           ev.getTag(TAG_NAME) == TAG_VALUE
        ).map(event => ({
          "startTime": event.getStartTime(),
          "endTime": event.getEndTime(),
          "delete": event.deleteEvent
        }))
    return evs
  }) ()
  Logger.log(`Found ${existingEvents.length} events on the existing calendar.`)

  const mergedEvents = mergeOverlappingEvents(sourceEvents)
  const [toInsert, toDelete] = partitionEvents(mergedEvents, existingEvents)
  Logger.log(`Found ${toInsert.length} events to insert.`)
  Logger.log(`Found ${toDelete.length} events to delete.`)

  for(const event of toInsert) {
    Logger.log("Creating: " + JSON.stringify(event))
    const ev = targetCal.createEvent("busy", event["startTime"], event["endTime"])
    ev.setTag(TAG_NAME, TAG_VALUE)
    ev.removeAllReminders()
    Utilities.sleep(1000)
  }
  for(const event of toDelete) {
    Logger.log("Deleting: " + JSON.stringify(event))
    try {
      event["delete"]()
    } catch {
      Logger.log("Couldn't delete an event, skipping")
    }
    Utilities.sleep(1000)
  }

  Logger.log("Done.")
}

function partitionEvents(sourceEvents: Event[], existingEvents: ExistingEvent[]): [Event[], ExistingEvent[]] {
  let left = [...sourceEvents].sort(compareEvent)
  let right = [...existingEvents].sort(compareEvent)

  let onlyLeft: Event[] = []
  let onlyRight: ExistingEvent[] = []

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

function mergeOverlappingEvents(evs: Event[]): Event[] {
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
