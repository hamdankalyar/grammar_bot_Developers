# 👨‍💻 Developer Quick Guide

## 🚨 IMPORTANT RULE

**❌ NEVER work directly on the `master` branch!**
**✅ Always create a new branch for your feature or fix.**

---

## 📦 Setup (First Time Only)

1. **Clone the main repository:**

   ```bash
   git clone https://github.com/ORIGINAL_OWNER/REPO_NAME.git
   cd REPO_NAME
   ```

2. **Configure your name and email (if not done):**

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```

3. **Check remotes (should be origin = main repo):**

   ```bash
   git remote -v
   ```

---

## 🔀 Daily Workflow

### 1. Sync with Master

```bash
git checkout master
git pull origin master
```

### 2. Create a New Branch

```bash
git checkout -b module/feature/your-feature-name
```

### 3. Work on Your Feature

* Make your changes
* Test your code
* Commit changes:

  ```bash
  git add .
  git commit -m "module/feature: What you did"
  ```

### 4. Push Your Branch

```bash
git push origin module/feature/your-feature-name
```

### 5. Create a Pull Request

* Go to GitHub
* Open a PR **into `master`**
* Add a title, description, and link to issue (if any)
* Request review

---

## 🏷️ Branch Naming

**Pattern:** `module/type/short-description`
**Examples:**

* `auth/feature/login-form`
* `ui/bugfix/fix-mobile-menu`
* `api/hotfix/user-token-expiry`
* `docs/update/readme-contributing`

**Modules:** `auth`, `ui`, `api`, `core`, `docs`, etc.
**Types:** `feature`, `bugfix`, `hotfix`, `update`

---

## ⚠️ What NOT to Do

* ❌ Don’t push directly to `master`
* ❌ Don’t skip testing your code
* ❌ Don’t commit without a clear message
* ❌ Don’t mix multiple features in one branch

---

## ✅ What TO Do

* ✅ Always create a separate feature branch
* ✅ Sync with `origin/master` before starting
* ✅ Use meaningful commit messages
* ✅ Open a Pull Request for every change
* ✅ Ask for feedback or code review

---

## 🧠 Useful Git Commands

```bash
# View branches
git branch

# Switch branch
git checkout branch-name

# Create + switch branch
git checkout -b module/feature/your-feature-name

# View status
git status

# See latest commits
git log --oneline --graph

# Undo file change
git checkout -- path/to/file

# Discard all local changes
git reset --hard
```

---

## 🦐 Need Help?

* Check existing issues
* Open a new issue with clear details
* Tag @repo-owner or your team lead in a comment

---

## 🔐 Reminder

**🔒 Master branch is protected — you must use feature branches + pull requests.**

---

# 🔄 Syncing with Upstream (For Forked Developers)

If you've forked this repo and are working in your own feature branch, follow these steps to get the latest **Prettier**, **.vscode settings**, and other shared updates without losing your work.

---

## ✅ One-Time Setup

1. **Add the original repo as `upstream`:**

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/REPO_NAME.git
   ```

2. **Verify remotes:**

   ```bash
   git remote -v
   ```

   You should see both `origin` (your fork) and `upstream` (the original).

---

## 🔁 Keep Your Fork and Branch Updated

1. **Switch to your local `master`:**

   ```bash
   git checkout master
   ```

2. **Fetch latest changes from upstream:**

   ```bash
   git fetch upstream
   ```

3. **Merge upstream `master` into your local `master`:**

   ```bash
   git merge upstream/master
   ```

4. **Push changes to your fork’s `master`:**

   ```bash
   git push origin master
   ```

5. **Switch back to your feature branch:**

   ```bash
   git checkout feature/your-feature-branch
   ```

6. **Merge updated `master` into your branch:**

   ```bash
   git merge master
   ```

   > If conflicts occur, Git will notify you. Manually resolve them, then commit.

---

## 🧹 Format Your Code (Prettier)

After syncing, run this to auto-format your code:

```bash
npm install
npm run format
```

Or simply **save your files in VS Code**, and formatting will happen automatically based on the included `.vscode/settings.json`.

---

## 💡 Tip

You can rebase instead of merging for a cleaner commit history:

```bash
git rebase master
```
