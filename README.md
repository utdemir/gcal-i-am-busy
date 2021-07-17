# gcal-i-am-busy

This Google Apps script creates "busy" events on a calendar based on another.

I am using this to mark the events on my personal calendar as "busy" on my work calendar.

## How it works

It fetches events from `SOURCE_CALENDAR` between 2 weeks ago and 2
months from now. Then fetches only the events with a specific tag from
`TARGET_CALENDAR`, for the same interval. Then it figures out which
events to insert to and delete from `TARGET_CALENDAR`, and applies them
with the correct tag.

I tried to make it hard for the code to mess with the existing events. So:

* It only ever modifies `TARGET_CALENDAR`.
* It can only modify/create events with a certain tag (`GCAL_I_AM_BUSY`).

However, there are no tests or real world use (yet). So, use at your
own risk. But do create an issue or send a PR if it does something wrong.

## Usage

1. Edit `src/Code.ts` to update `SOURCE_CALENDAR_ID` and `TARGET_CALENDAR_ID`.

2. Create and deploy the Apps Script using [clasp][]:

```
$ npm install
$ npx tsc
$ npx clasp login
$ npx clasp create # when prompted, this is a 'standalone' script
$ npx clasp push
```

3. Navigate to https://script.google.com/home. You should see the project appear.
4. Click 'Run'. It should ask for some permissions.
5. Observe the "Execution log" until you see "Execution completed".
   * The initial run might take a while since it will synchronize 75 days of events.
     Following runs should be incremental.
6. Click "Triggers" on the sidebar, and add a trigger.
   * Which function to run: `main`
   * Event source: `Time-driven`
   * Set the time trigger and the interval as you wish. I have it on every 10 minutes.

[clasp]: https://github.com/google/clasp

## Disclaimer

Don't blame me if this breaks. See [LICENSE.md](./LICENSE.md).

## See also

* [karbassi/sync-multiple-google-calendars](https://github.com/karbassi/sync-multiple-google-calendars)

