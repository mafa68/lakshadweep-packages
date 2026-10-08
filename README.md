# Lakshadweep Packages – deploy on Netlify

Owners sign up and log in, then add, edit, hide and delete their own packages. Packages go live instantly (no approval).
Admins log in with the same form and get an **Admin** page to manage every package and owner account.

## Deploy (about 10 minutes)
1. Create a free account at https://app.netlify.com and a free account at https://github.com.
2. Create a new GitHub repository and upload everything in this folder to it.
3. In Netlify: **Add new project → Import an existing project → GitHub**, pick the repository.
   Build settings are read from `netlify.toml` (build command `npm run build`, publish folder `public`).
4. Before the first deploy (or afterwards, then redeploy), open **Project configuration → Environment variables** and add:
   `ADMIN_EMAILS` = your email (several admins: comma separated, e.g. `me@mail.com,partner@mail.com`)
5. Open **Project configuration → Identity** (or the Identity page for the project) and click **Enable Identity**.
   Keep registration **open** so owners can sign up. Email confirmation can stay on (recommended).
6. Deploy. Open your `*.netlify.app` address.
7. Click **For package owners → Create account** using the same email you put in `ADMIN_EMAILS`, confirm the email,
   then log in. An **Admin** link appears in the top menu.

## Notes
- Login and the database only work on the deployed Netlify site, not when opening `index.html` from your computer.
  (Netlify Identity does not work under `netlify dev`.) Without the backend, the site shows sample packages only.
- Packages are stored in Netlify Blobs. The public site lists packages with status "live".
- Sample packages appear only while no real package exists. Once the first owner publishes, they disappear.
- Admin = any logged-in user whose email is in `ADMIN_EMAILS`. Change admins by editing that variable and redeploying.
- Deleting an owner account in the Admin page also deletes their packages.
- Since there is no approval step, check the Admin page regularly and hide or delete anything inappropriate.
- Netlify plans and credit limits change; check https://www.netlify.com/pricing before launch.
- Email confirmation: new accounts must confirm their email (link sent by Netlify) before they can log in. Keep this ON: admin access is decided by email, so confirmation proves the person owns that address. Do not enable autoconfirm.
