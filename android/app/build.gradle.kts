plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "cn.yourletters.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "cn.yourletters.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    /*
     * 正式签名（只在 CI 里有 4 个 Secrets 时启用）
     *   KEYSTORE_PATH / KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD
     *   · 没配这几个变量（比如你本地直接构建）→ 自动跳过 ✓ 不会构建失败 ✓
     *   · 配了 → release 包就用**你自己的签名** ✓
     *     以后新包可以直接覆盖安装 ✓ 不用卸载 ✓ 商店也认 ✓
     */
    val ksPath = System.getenv("KEYSTORE_PATH")
    val ksPass = System.getenv("KEYSTORE_PASSWORD")
    val ksAlias = System.getenv("KEY_ALIAS")
    val ksKeyPass = System.getenv("KEY_PASSWORD")

    signingConfigs {
        if (!ksPath.isNullOrBlank() && file(ksPath).exists()) {
            create("release") {
                storeFile = file(ksPath)
                storePassword = ksPass
                keyAlias = ksAlias
                keyPassword = ksKeyPass
                storeType = "PKCS12"   // openssl 生成的就是 PKCS12 ✓ Android 认 ✓
            }
        }
    }

    buildTypes {
        // 用 debug 就够：它自动用调试签名 ✓ 朋友直接能装 ✓ 不需要你做 keystore
        getByName("debug") {
            isMinifyEnabled = false
        }
        getByName("release") {
            isMinifyEnabled = false
            // 有正式签名就用正式签名，没有就退回 debug 签名（保证一定能出包 ✓）
            signingConfig =
                signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
}
