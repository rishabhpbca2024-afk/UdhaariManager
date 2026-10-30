# Udhaari Manager (उधारी मैनेजर) 📱

An offline-first, private, local-only Android application designed to track and manage personal and small business udhaari (money lent or borrowed). 

**100% Free & Open-Source. Zero Cloud Databases. Zero Paid APIs. Zero Subscriptions.**

---

## 🌟 Key Features

### 1. Offline-First Ledger
- Runs entirely offline without requiring an active internet connection.
- Backed by a high-performance **native SQLite database** on Android (`@capacitor-community/sqlite`).
- Data is stored in private internal storage on your device (`udhaari_manager_db`).
- Preserves your entire transaction ledger across app updates and phone restarts.

### 2. Accurate Financial Calculations (Paise-Safe)
- Eliminates floating-point rounding errors by storing all currency as safe 64-bit integers in **paise** (1 INR = 100 paise).
- Amounts are formatted in standard Indian Rupee notation (e.g. ₹500, ₹1,500, ₹1,50,000).
- Fully repaid loans are strictly excluded from the outstanding total and overdue total.
- Overdue tracking dynamically checks when an expected repayment date has elapsed.

### 3. Comprehensive Dashboard
- **Total Outstanding Money**: Real-time balance of unpaid udhaari.
- **Overdue Amount & Count**: Instant visual warnings for borrowers whose due dates have passed.
- **Pending Records Count**: Total count of active borrowers awaiting repayment.
- **Total Repaid to Date**: Lifetime record of settled debts.
- **Quick Action CTA**: One-tap shortcut to record new udhaari.

### 4. Records & Search
- Full list of all transactions with status badges: **Pending** (amber), **Overdue** (red), and **Repaid** (green).
- Instant search filter by borrower's name, notes, or phone number.
- Category pills: **All**, **Pending**, **Overdue**, **Repaid**.
- Sorting options:
  - Newest Given Date
  - Upcoming Due Date
  - Oldest Given Date
  - Highest Amount (₹)
  - Lowest Amount (₹)
- One-tap status toggle: **Mark Repaid** / **Mark Pending**.
- Quick call (`tel:`) and WhatsApp chat shortcuts if a mobile number is entered.
- Safe Edit and Delete actions with confirmation modals.

### 5. Backup & Restore
- **Export Backup**: Download your ledger as a verified JSON file at any time.
- **Import / Restore**: Restore previous backups with strict schema validation.
- **Safe Conflict Handling**: Offers a choice between **Merge** (keeps current records and adds/updates matching entries) and **Replace** (clean restoration with confirmation).
- Clear warnings reminding users that uninstalling or wiping app storage removes local data, encouraging routine backups.

---

## 🛠 Technology Stack

- **UI Framework**: React 19 + TypeScript + Vite
- **Mobile Container**: Capacitor 7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`)
- **Native Database**: SQLite via `@capacitor-community/sqlite`
- **Iconography**: `lucide-react` (100% bundled locally; no remote CDN dependencies)
- **Styling**: Vanilla CSS design system with rich glassmorphism, responsive mobile layouts, and safe-area padding for Android.

---

## 💻 Exact Windows PowerShell Commands

### 1. Install Dependencies
```powershell
npm install
```

### 2. Run App in Browser During Development
```powershell
npm run dev
```
> *In web development mode, the app uses a persistent offline browser storage fallback so you can test forms, validations, searches, and calculations immediately.*

### 3. Build Web Assets
```powershell
npm run build
```

### 4. Add Android Platform (Only if not already added)
```powershell
npx cap add android
```
*(Note: The `android` directory is already generated and configured in this project).*

### 5. Sync Web Assets to Android
```powershell
npx cap sync android
```

### 6. Open Project in Android Studio
```powershell
npx cap open android
```

### 7. Build Installable APKs via Command Line

#### Build Debug APK:
```powershell
$env:ANDROID_HOME="C:\Users\hp\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleDebug
cd ..
```
The debug APK is generated at:
`android\app\build\outputs\apk\debug\app-debug.apk`

#### Build Release APK:
```powershell
$env:ANDROID_HOME="C:\Users\hp\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleRelease
cd ..
```
The unsigned release APK is generated at:
`android\app\build\outputs\apk\release\app-release-unsigned.apk`

#### Create a Personal Keystore & Sign the Release APK (One-Time Setup):
To create a self-signed release APK for personal phone use:

```powershell
# 1. Generate personal keystore (Run once)
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias udhaari -storepass password123 -keypass password123 -dname "CN=UdhaariManager, OU=Dev, O=Self, L=Delhi, S=Delhi, C=IN"

# 2. Sign the APK using jarsigner (JDK 17)
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore my-release-key.jks -storepass password123 -keypass password123 android\app\build\outputs\apk\release\app-release-unsigned.apk udhaari

# 3. Optimize and align the signed APK using zipalign
& "C:\Users\hp\AppData\Local\Android\Sdk\build-tools\36.0.0\zipalign.exe" -v 4 android\app\build\outputs\apk\release\app-release-unsigned.apk UdhaariManager-Release.apk
```

---

## 📲 How to Transfer and Install the APK on Your Android Phone

You do **not** need a Google Play Developer account to install and use Udhaari Manager. You can sideload the APK directly onto your phone:

### Method A: Direct USB Transfer
1. Connect your Android phone to your PC via a USB cable.
2. On your phone, set the USB mode to **File Transfer / MTP**.
3. In Windows File Explorer, copy `app-debug.apk` (or `UdhaariManager-Release.apk`) into your phone's **Downloads** folder.
4. On your phone, open the **Files** or **File Manager** app, navigate to **Downloads**, and tap the APK file.
5. If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*:
   - Tap **Settings**.
   - Toggle **Allow from this source** to ON.
   - Return and tap **Install**.
6. Tap **Open** to start managing your Udhaari!

### Method B: Google Drive / WhatsApp / LocalSend
1. Upload the generated `.apk` file to your personal Google Drive or send it to yourself via WhatsApp / Telegram / LocalSend.
2. Download the `.apk` file onto your Android phone.
3. Tap the file in your notification bar or Downloads folder to install it.

---

## 🔒 Privacy & Offline Architecture

- **No Remote Servers**: Financial records never leave your phone.
- **No Internet Permission Required**: The Android app does not even request network access for core functionality.
- **No Ads or Analytics**: Zero tracking SDKs, zero background data collection.
- **ACID-Compliant Transactions**: SQLite ensures that unexpected app closures or low-battery shutdowns never corrupt your records.

---

## 📂 Project Structure

```
MyApp/
├── android/                   # Native Android Project (Capacitor + SQLite)
│   ├── app/
│   │   ├── build.gradle       # App Gradle configuration & dependencies
│   │   └── src/main/          # Native Android code and AndroidManifest.xml
│   └── gradlew.bat            # Gradle wrapper for automated builds
├── src/
│   ├── components/            # UI Components
│   │   ├── BackupScreen.tsx   # Export & Restore UI with schema validation
│   │   ├── ConfirmModal.tsx   # Action confirmation dialogs
│   │   ├── Dashboard.tsx      # Outstanding balance, overdue alerts & stats
│   │   ├── Header.tsx         # Brand header and quick add button
│   │   ├── RecordCard.tsx     # Transaction card with status and action buttons
│   │   ├── RecordList.tsx     # Searchable, filterable list of records
│   │   ├── Toast.tsx          # Non-intrusive alert toasts
│   │   └── UdhaariFormModal.tsx # Add/Edit form with INR rupee helpers
│   ├── services/
│   │   ├── backup.ts          # JSON export/import validation logic
│   │   ├── db.ts              # SQLite database adapter (Native & Web fallback)
│   │   └── repository.ts      # CRUD operations and financial metric calculations
│   ├── types/
│   │   └── udhaari.ts         # TypeScript data definitions
│   ├── utils/
│   │   ├── currency.ts        # Safe integer paise conversions & INR formatters
│   │   └── date.ts            # Local YYYY-MM-DD date helpers & overdue detection
│   ├── App.tsx                # Main screen router and state coordination
│   ├── index.css              # Rich modern design system
│   └── main.tsx               # Application bootstrap
├── capacitor.config.ts        # Capacitor mobile settings
└── package.json               # Dependencies and scripts
```
