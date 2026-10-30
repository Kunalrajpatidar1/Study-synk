
# Study Sync

Study Sync is a responsive YouTube playlist length calculator with speed estimates, a study planner, local watch progress, and iCalendar export.

## Run locally

1. Create a YouTube Data API v3 key in Google Cloud and enable the YouTube Data API v3 for the project.
2. Copy `.env.example` to `.env` and set `VITE_YOUTUBE_API_KEY` to the key.
3. Restrict the key to the YouTube Data API and your local/production HTTP referrers. Vite embeds `VITE_` variables in browser code, so the key is public and must be restricted.
4. Run `npm install`, then `npm run dev` for the frontend.

## Live Google Calendar subscriptions

The planner can publish a private `.ics` feed that Google Calendar refreshes periodically. Calendar feeds are stored in Upstash Redis and served by the Vercel API functions in `api/calendar`.

### Deploy to Vercel

1. **Push the project to GitHub.** If it is not already in a Git repository, create a repository, then commit and push the project. Do not commit `.env`; it contains API credentials.
2. **Import the repository into Vercel.** Sign in to Vercel, choose **Add New → Project**, import the GitHub repository, and keep the detected Vite settings: build command `npm run build`, output directory `dist`, and install command `npm install`.
3. **Create a YouTube API key.** In Google Cloud Console, create or select a project, enable **YouTube Data API v3**, and create an API key. Restrict it to the YouTube Data API and to your deployed website's HTTP referrers. Add it in Vercel under **Project → Settings → Environment Variables** as `VITE_YOUTUBE_API_KEY`, for Production (and Preview if desired).
4. **Create an Upstash Redis database.** In the Vercel project, open **Storage/Integrations** and connect an Upstash Redis database through the Vercel Marketplace. Alternatively, create a Redis database in Upstash and copy its REST URL and REST token. Add these server-only variables in Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   Never prefix these two values with `VITE_`: they must not be exposed in browser code.
5. **Deploy or redeploy.** Trigger a new deployment after adding environment variables so both the frontend build and API functions receive the configuration. Open the production URL and try loading a public YouTube playlist.
6. **Create the subscription.** Calculate a playlist, configure the study plan and start time, then select **Create calendar feed**. After it succeeds, select **Subscribe in Google Calendar** and confirm the subscription in Google Calendar.
7. **Verify and manage it.** Confirm the calendar appears in Google Calendar. Keep the planner open in this browser while changing the study plan; its live feed updates automatically. Choose **Revoke feed** when you no longer want the feed URL to work.

Treat the feed URL like a private link: anyone who has it can read the planned sessions. A separate management key is stored in this browser so feed readers cannot update or revoke the feed. Keep access to this browser if you want to manage it later.

### Calendar options

- **Add beside a session** or **Add first session to Google Calendar** opens a prefilled event draft. Sign in if prompted, review it, and save it.
- **Add all sessions to Google Calendar** downloads an `.ics` file and opens Google Calendar's import page. Import the file to add a one-time copy of the plan.
- **Create calendar feed → Subscribe in Google Calendar** creates an ongoing, read-only subscription. The planner publishes changes while open in the same browser; Google refreshes subscribed calendars on its own schedule, so changes may take several hours to appear. Feed updates retain stable event IDs to avoid duplicating sessions.

A YouTube API key alone cannot write to a user's Google Calendar. Event drafts and `.ics` import do not require Google Calendar API credentials or OAuth. A live subscription requires the deployed Vercel API and configured Upstash Redis.

### Test calendar feeds locally

`npm run dev` starts Vite only; it does not serve the `/api/calendar` functions. For local API testing:

1. Install/link the Vercel CLI and link the local project to your Vercel project.
2. Put `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the local `.env` file. Add `VITE_YOUTUBE_API_KEY` there too if testing playlist lookup.
3. Run `npx vercel dev` and open the local URL printed by the CLI. Do not use the Vite-only `npm run dev` URL to test feed creation.

### Troubleshooting

- **Calendar API returns 404 or says Vite doesn't run Vercel Functions:** use the deployed Vercel URL or start local development with `npx vercel dev`.
- **Calendar API returns a storage/configuration error:** check that both Upstash REST environment variables are set for the active Vercel environment, then redeploy.
- **Playlist lookup fails:** confirm `VITE_YOUTUBE_API_KEY` is set in Vercel, the YouTube Data API v3 is enabled, and the key's referrer restrictions include the deployed domain; redeploy after changing it.
- **The subscription was created but changes are not visible yet:** Google Calendar periodically refreshes external calendars; refresh is not immediate. Keep Study Sync open after changing the plan, then allow time for Google's next refresh.

Use `npm run build` to type-check and create the production bundle.

## Features

- Playlist, video, and channel-link lookup, with pagination capped at 5,000 playlist items.
- Side-by-side comparison of up to five links, playback-speed calculations, and a configurable daily study plan that caps sessions at the selected watch time and splits long videos at timestamped segments.
- Per-playlist watched progress stored only in the browser's local storage.
- Google Calendar event drafts for individual sessions, a bulk `.ics` import, and an optional live subscription feed. Events are titled `Session N of M · HH:MM:SS` and include numbered videos, timestamped video segments, watch-time estimates, YouTube links, and a link back to the playlist plan.

Individual Google Calendar links open a prefilled event draft; sign in if prompted, review the event, and save it. To add the full plan once, use **Add all sessions to Google Calendar**, then choose the downloaded `.ics` file on Google Calendar's import page. A Google API key alone cannot write events to a user's calendar. Live subscriptions use the public read-only feed described above; they do not require Calendar API or OAuth credentials.
=======
# Study-synk
>>>>>>> 759257647d9ed4c77ebd1d6b6ed3e63db1731d52
=======
# Study-synk
>>>>>>> 6bd87161a3c49eef2fa5911630051005808ed8c2
