# Developer Quick Guide

## 🚨 **IMPORTANT RULE**
**❌ NEVER work directly on the `master` branch!**  
**✅ Always create a feature branch for your work.**

---

## 📋 Quick Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd REPO_NAME
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/REPO_NAME.git
   ```

---

## 🔄 Daily Workflow

### 1. Start Your Work
```bash
# Always sync first
git checkout master
git pull upstream master
git push origin master

# Create your feature branch
git checkout -b module/feature/your-feature-name
```

### 2. Make Your Changes
- Edit files
- Test your changes
- Commit regularly:
  ```bash
  git add .
  git commit -m "module/feature: What you did"
  ```

### 3. Submit Your Work
```bash
# Push to your fork
git push origin module/feature/your-feature-name

# Then create a Pull Request on GitHub
```

---

## 🏷️ Branch Naming

**Format:** `module/feature/description`

**Examples:**
- `auth/feature/login-form`
- `ui/bugfix/mobile-menu`
- `api/feature/user-endpoints`
- `docs/update/readme-fix`

**Modules:** `auth`, `ui`, `api`, `core`, `docs`  
**Types:** `feature`, `bugfix`, `hotfix`, `update`

---

## ⚠️ What NOT to Do

- ❌ Don't push directly to `master`
- ❌ Don't work on multiple features in one branch  
- ❌ Don't commit without testing
- ❌ Don't use unclear commit messages

---

## ✅ What TO Do

- ✅ Always create a feature branch
- ✅ Sync with upstream regularly
- ✅ Write clear commit messages
- ✅ Test before pushing
- ✅ Create Pull Requests for review

---

## 🔧 Quick Commands

```bash
# Sync with main repo
git pull upstream master

# Check which branch you're on
git branch

# Switch branches
git checkout branch-name

# See your changes
git status

# Undo local changes
git checkout -- filename
```

---

## 🆘 Need Help?

1. Check existing issues first
2. Create a new issue with details
3. Ask in discussions
4. Contact: @your-username

**Remember: No direct work on master! Always use feature branches! 🚨**
