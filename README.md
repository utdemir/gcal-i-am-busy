# gcal-i-am-busy

This Google Apps script creates "busy" events on a calendar based on another.

I am using this to mark the events on my personal calendar as "busy" on my
work calendar.

## How it works

It fetches all events from `SOURCE_CALENDAR` between 1 week ago and 2 months
from now and events with a specific tag from `TARGET_CALENDAR`, for the same
interval. Then it compares them to figure out which events to insert to and
delete from `TARGET_CALENDAR`, and applies the changes with the correct tag.

I tried to make it hard for the code to mess with the events it is not
managing. So:

* It only ever modifies `TARGET_CALENDAR`.
* It only reads the following fields from the events in `SOURCE_CALENDAR`:
   `startTime`, `endTime`, `allDayEvent`, `myStatus`, and `tag`. (Note, all
   but the first two may be unavailable depending on sharing settings.)
* It can only modify/create events with a certain tag (`GCAL_I_AM_BUSY`).

However, the real world always presents unexpected conditions, so, use at your
own risk. But do create an issue or send a PR if it does something wrong.

## Bidirectional syncing

It's possible to use this script on both sides of a pair of calendars shared
to one another to synchronize bidirectionally. Just deploy it (as described
below) to both places, with source and target calendar IDs swapped.

The script is designed to make sure it doesn't sync events it itself has
generated on the other side. It will look for its `GCAL_I_AM_BUSY` tag, but if
the foreign calendar is set to share only busy/free (start/end times of
confirmed events), the tag will not be visible. For this reason, it sets the
`seconds` field of the start time of events it creates to 41 seconds (a value
picked for unlikelihood of occurring by chance), and will not sync any events
that have a seconds field set to this value.

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

3. Navigate to https://script.google.com/home. You should see the project
   appear, open it.
4. Set the function to run "main".
5. Click 'Run'. It should ask for some permissions.
6. Observe the "Execution log" until you see "Execution completed".
   * The initial run might take a while since it will synchronize 60 days of events.
     Following runs should be incremental.
7. Click "Triggers" on the sidebar, and add a trigger.
   * Which function to run: `main`
   * Event source: `Time-driven`
   * Set the time trigger and the interval as you wish.

7. To redeploy after changes made to the typescript source:

```
$ npx tsc
$ npx clasp push
```

[clasp]: https://github.com/google/clasp

### Removing the events created by this script

If you want to delete the events created with this script for some reason,
here is a way to do that.

1. Open the deployed scripts code on Google App Script page.
2. Set the `DELETE_ALL` constant to `true`.
3. Using the toolbar above:
   1. Save the script
   2. Set the function to run to "main"
   3. Click the "Run" button.
4. Watch the message box below until the script completes.

* If you don't want to use the script anymore, don't forget to delete the
  project, or at least disable the triggers.
* If you want to use the script again, just set the constant back to `false`,
  or run `npx clasp push` again.

## Disclaimer

Don't blame me if this breaks. See [LICENSE.md](./LICENSE.md).

## See also

* [karbassi/sync-multiple-google-calendars](https://github.com/karbassi/sync-multiple-google-calendars)

