package cn.yourletters.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.Manifest
import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * 你的来信 · 安卓壳
 *
 * 用系统自带的 WebView（每台安卓都有 ✓ 不依赖 Chrome ✗）
 * 三件必要的事：
 *   ① 头像上传 → 实现 onShowFileChooser（不然选图会没反应 ✗）
 *   ② 返回键 → 能回上一页就回页，回不了才退出 App ✓
 *   ③ 站外链接（比如邮件里的确认链接）→ 交给系统浏览器 ✓ 别困在壳子里 ✗
 */
class MainActivity : AppCompatActivity() {

    private var web: WebView? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var geoCallback: GeolocationPermissions.Callback? = null
    private var geoOrigin: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val wv = WebView(this)
        setContentView(wv)
        web = wv

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                 // localStorage：登录状态要用 ✓
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false // 音乐/语音能直接播 ✓
            useWideViewPort = true
            loadWithOverviewMode = true
            setGeolocationEnabled(true)   // 网页里的 navigator.geolocation 才能用 ✓
        }

        wv.webChromeClient = object : WebChromeClient() {
            // 网页要用定位 → 先按安卓规矩弹授权框 ✓ 授权后回答网页 ✓
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?,
            ) {
                if (origin == null || callback == null) return
                val granted = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                ) == PackageManager.PERMISSION_GRANTED
                if (granted) {
                    callback.invoke(origin, true, false)
                    return
                }
                geoCallback = callback
                geoOrigin = origin
                ActivityCompat.requestPermissions(
                    this@MainActivity,
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                    REQ_LOCATION,
                )
            }

            // 头像/图片上传：把系统文件选择器接上 ✓
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(params!!.createIntent(), REQ_FILE)
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val url = request?.url ?: return false
                val host = url.host ?: return false
                // 站内自己走；站外交给系统浏览器 ✓
                if (host.endsWith("yourletters.cn")) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        if (savedInstanceState == null) {
            wv.loadUrl(START_URL)
        } else {
            wv.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    /** 用户点了"允许/拒绝"之后，把结果告诉网页 ✓（拒绝也要回答，否则网页会一直等 ✗） */
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (requestCode == REQ_LOCATION) {
            val ok = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            geoCallback?.invoke(geoOrigin, ok, false)
            geoCallback = null
            geoOrigin = null
            return
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    @Deprecated("文件选择器用老接口最省事，且不需要额外依赖")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            val cb = fileCallback
            fileCallback = null
            if (cb == null) return
            val uris: Array<Uri>? = try {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } catch (e: Exception) {
                null
            }
            cb.onReceiveValue(uris)
            return
        }
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onBackPressed() {
        val wv = web
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    companion object {
        private const val START_URL = "https://yourletters.cn"
        private const val REQ_FILE = 1001
        private const val REQ_LOCATION = 1002
    }
}
