# HostelConnect — Smart Hostel Management System

A beginner-friendly hostel management website demo made with plain HTML, CSS, and JavaScript. It runs in your browser without installing a framework or setting up a server.

## Run it in Visual Studio Code

1. Install [Visual Studio Code](https://code.visualstudio.com/) if you do not already have it.
2. Open this `hostelconnect` folder in VS Code (**File → Open Folder**).
3. Open `index.html` in your browser. You can also install the **Live Server** extension in VS Code, right-click `index.html`, and choose **Open with Live Server**. Live Server refreshes the page when you save changes.
4. Sign in with one of these demo accounts:

   | Role | Email | Password |
   | --- | --- | --- |
   | Student | `student@hostelconnect.demo` | `hostel123` |
   | Warden | `warden@hostelconnect.demo` | `hostel123` |

## What you can try

- **Student:** view the dashboard and announcements, submit leave requests and complaints, and see their statuses.
- **Warden:** review and approve or decline leave, update complaint statuses, add and edit rooms, and publish announcements.
- Search/filter rooms and complaints. Changes are stored in your browser using `localStorage` and remain after refreshing the page.
- To reset the sample records, open browser developer tools → Application/Storage → Local Storage → delete `hostelconnect-data`, then refresh the page. Sign out and sign in again if needed.

## Project files

- `index.html` — page structure and login screen
- `styles.css` — layout, colors, and responsive styling
- `app.js` — demo data, login roles, page rendering, and interactions

## Important demo limitation

This is a frontend-only learning project. The accounts are sample accounts, and browser storage is not secure authentication or a shared database. Do not enter real personal information. To make this production-ready, replace the demo login and local storage with a backend, secure authentication, and a database.

## Push it to GitHub

Create an empty repository on GitHub first (do not add a README there if you already have this one). In VS Code, open **Terminal → New Terminal** in this folder and run these commands one at a time. Replace `YOUR-USERNAME` and `YOUR-REPOSITORY` with your GitHub details:

```bash
git init
git add .
git commit -m "Build HostelConnect demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

GitHub may open a browser window for you to sign in. For later changes, use:

```bash
git add .
git commit -m "Describe your change"
git push
```

## Beginner build order

1. Start with `index.html` and identify the login form and main app sections.
2. Change colors and spacing in `styles.css`; save and refresh the browser.
3. In `app.js`, explore the `seed` object to see the example rooms and requests.
4. Try the student and warden accounts and make a change in each role.
5. Push the finished version to GitHub using the commands above.
