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
     * 正式签名（可选）
     *   签名文件放在 android/yourletters.keystore ✓
     *   三个密码从环境变量读：KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD
     *   **文件不存在就不创建这个配置** → release 自动退回 debug 签名 ✓ 绝不会构建失败 ✓
     */
    signingConfigs {
        val keystoreFile = rootProject.file("yourletters.keystore")
        if (keystoreFile.exists()) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("KEY_ALIAS") ?: ""
                keyPassword = System.getenv("KEY_PASSWORD") ?: ""
                storeType = "PKCS12"
            }
            logger.lifecycle("[签名] 找到 yourletters.keystore，release 将使用正式签名 ✓")
        } else {
            logger.lifecycle("[签名] 没有 yourletters.keystore，release 使用 debug 签名（能装，但不能覆盖升级）")
        }
    }

    buildTypes {
        // 用 debug 就够：它自动用调试签名 ✓ 朋友直接能装 ✓ 不需要你做 keystore
        getByName("debug") {
            isMinifyEnabled = false
        }
        getByName("release") {
            isMinifyEnabled = false
            val rel = signingConfigs.findByName("release")
            if (rel != null) {
                signingConfig = rel
            }
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
