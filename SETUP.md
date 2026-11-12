# Setup

You do these steps one time. After that, both phones use the app with no more setup.

The steps are in four parts:

1. Make Google keys for the app (about 15 minutes).
2. Run the app on this PC to test it.
3. Put the app on a free HTTPS host, so that the phones can open it.
4. Connect the two phones to one shared list.

## 1. Make the Google keys

The app uses the `drive.file` permission only. With this permission, the app can see the files that it makes and the
files that you pick. It cannot see other files in your Drive.

1. Go to <https://console.cloud.google.com/> and sign in with your Google account.
2. Make a new project. Give it a name, for example "Grocery app".
3. On the project dashboard, find **Project number**. Write it down. This is `VITE_GOOGLE_APP_ID`.
4. Go to **APIs & Services → Library**. Enable **Google Drive API**. Then enable **Google Picker API**.
5. Go to **Google Auth Platform → Branding** (older consoles call it "OAuth consent screen").
   - Set the app name and your email.
   - Set **Audience** to **External**. Keep the publishing status at **Testing**.
   - Under **Test users**, add your Gmail address and your wife's Gmail address.
6. Go to **Google Auth Platform → Data access**. Add the scope `https://www.googleapis.com/auth/drive.file`.
7. Go to **Google Auth Platform → Clients** and make a client of type **Web application**.
   - Under **Authorized JavaScript origins**, add `http://localhost:5173`.
   - Also add the address of your host from part 3, for example `https://YOUR-GITHUB-NAME.github.io`.
   - You do not need redirect URIs.
   - Copy the **Client ID**. This is `VITE_GOOGLE_CLIENT_ID`.
8. Go to **APIs & Services → Credentials → Create credentials → API key**.
   - Under **Application restrictions**, select **Websites**. Add `http://localhost:5173/*` and
     `https://YOUR-GITHUB-NAME.github.io/*`.
   - Under **API restrictions**, select **Google Picker API** only.
   - Copy the key. This is `VITE_GOOGLE_API_KEY`.

These three values are not secrets. They go into the app, and every browser that opens the app can see them. The
restrictions in steps 7 and 8 stop other websites from using them.

## 2. Run the app on this PC

The project has its own copy of Node.js in `.tools/`. It does not change your system. Each new PowerShell window needs
this command first:

```powershell
. .\scripts\use-node.ps1
```

Copy `.env.example` to `.env.local` and put the three values from part 1 into it. Then start the app:

```powershell
npm run dev
```

Open <http://localhost:5173>. To test two phones on one PC, open the app in a normal window and in a private window.
Sign in with your account in one window and with your wife's account in the other.

Other commands:

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm test`          | Runs the unit tests for the list and sync logic |
| `npm run typecheck` | Checks the TypeScript types                     |
| `npm run build`     | Makes the production build in `dist/`           |
| `npm run icons`     | Makes the app icons in `public/icons/` again    |

## 3. Put the app on a free HTTPS host

The phones need an HTTPS address. Google sign-in and app install do not work on a plain `http://` address on a phone.
The host keeps only the app files. Your list stays in Google Drive.

The project has a GitHub Actions workflow for GitHub Pages in `.github/workflows/deploy.yml`:

1. Make a GitHub repository, for example `grocery-app`, and push this project to it.
2. In the repository, go to **Settings → Pages**. Set **Source** to **GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables**. Add three repository variables:
   `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` and `VITE_GOOGLE_APP_ID`.
4. Push to `main`, or run the workflow by hand from the **Actions** tab.
5. The app is then at `https://YOUR-GITHUB-NAME.github.io/grocery-app/`.

Make sure that the origin `https://YOUR-GITHUB-NAME.github.io` is in the OAuth client (part 1, step 7).

## 4. Connect the two phones

On your phone:

1. Open the app address in Chrome.
2. Type your name.
3. Tap the settings icon. Tap **Create a new shared list**.
4. Sign in with Google and allow the app to use its own files.
5. Open settings again. Type your wife's Gmail address under **Share with** and tap **Send invite**.

On your wife's phone:

1. Open the app address in Chrome.
2. Type her name.
3. Tap the settings icon. Tap **Join a list shared with me**.
4. Sign in with Google. In the file picker, select the grocery list file.

To put the app on the home screen, open the Chrome menu (⋮) and tap **Add to home screen** or **Install app**.

## Things to know

- **Sign-in expiry.** A Google sign-in in the browser stays valid for about one hour. After that, the app shows a
  **Sign in to Google** button. One tap fixes it, and the app does not ask for the permission again. A native app
  version can remove this step (see README).
- **Offline.** You can add and tick items with no signal. The phone keeps the changes and syncs them when the signal
  comes back.
- **Testing mode.** While the Google project is in **Testing**, only the test users from part 1, step 5 can sign in.
  This is correct for a household. To release the app to the public, you must publish the consent screen. The
  `drive.file` scope does not need a Google security review.
