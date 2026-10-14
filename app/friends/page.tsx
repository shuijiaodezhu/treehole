'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Friend = {
  friendship_id: string
  friend_id: string
  username: string
  nickname: string | null
  avatar_url: string | null
  signature: string | null
}

type Request = {
  friendship_id: string
  requester_id: string
  username: string
  nickname: string | null
  avatar_url: string | null
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }
    const uid = userData.user.id

    // 已接受的好友
    const { data: accepted } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .eq('status', 'accepted')

    if (accepted && accepted.length > 0) {
      const friendIds = accepted.map((f) =>
        f.requester_id === uid ? f.addressee_id : f.requester_id
      )
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url, signature')
        .in('id', friendIds)

      const list: Friend[] = accepted.map((f) => {
        const fid = f.requester_id === uid ? f.addressee_id : f.requester_id
        const p = profilesData?.find((x) => x.id === fid)
        return {
          friendship_id: f.id,
          friend_id: fid,
          username: p?.username || '未知',
          nickname: p?.nickname || null,
          avatar_url: p?.avatar_url || null,
          signature: p?.signature || null,
        }
      })
      setFriends(list)
    } else {
      setFriends([])
    }

    // 待处理的申请（别人发给我的）
    const { data: pending } = await supabase
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', uid)
      .eq('status', 'pending')

    if (pending && pending.length > 0) {
      const reqIds = pending.map((r) => r.requester_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url')
        .in('id', reqIds)

      const list: Request[] = pending.map((r) => {
        const p = profilesData?.find((x) => x.id === r.requester_id)
        return {
          friendship_id: r.id,
          requester_id: r.requester_id,
          username: p?.username || '未知',
          nickname: p?.nickname || null,
          avatar_url: p?.avatar_url || null,
        }
      })
      setRequests(list)
    } else {
      setRequests([])
    }

    setLoading(false)
  }

  async function handleSearch() {
    if (!searchInput.trim()) return
    setSearching(true)
    setSearchResult(null)
    setSearchMessage('')

    const keyword = searchInput.trim()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_url, signature')
      .or(`username.eq.${keyword},nickname.eq.${keyword}`)
      .limit(1)

    if (data && data.length > 0) {
      const found = data[0]
      const { data: userData } = await supabase.auth.getUser()
      if (found.id === userData.user?.id) {
        setSearchMessage('这是你自己')
      } else {
        setSearchResult(found)
      }
    } else {
      setSearchMessage('没找到这个人（要输入完整的用户名或昵称）')
    }
    setSearching(false)
  }

  async function handleAddFriend(targetId: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    // 检查是否已经存在关系
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${userData.user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userData.user.id})`
      )

    if (existing && existing.length > 0) {
      alert('你们已经是好友，或者已经发过申请了')
      return
    }

    const { error } = await supabase.from('friendships').insert({
      requester_id: userData.user.id,
      addressee_id: targetId,
      status: 'pending',
    })

    if (error) {
      alert('发送失败：' + error.message)
    } else {
      alert('好友申请已发送')
      setShowAdd(false)
      setSearchInput('')
      setSearchResult(null)
    }
  }

  async function handleAccept(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    if (error) {
      alert('操作失败：' + error.message)
    } else {
      loadAll()
    }
  }

  async function handleReject(friendshipId: string) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) {
      alert('操作失败：' + error.message)
    } else {
      loadAll()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">小屋</h1>
        <p className="text-sm text-gray-500 mt-1">小屋里，只有熟人</p>

        <div className="flex gap-4 mt-4 border-b">
          <span className="pb-2 border-b-2 border-orange-500 text-orange-500 font-medium text-sm">好友</span>
          <Link
            href="/friends/moments"
            className="pb-2 text-gray-500 hover:text-gray-800 text-sm"
          >
            朋友圈
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {/* 加好友按钮 */}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          {showAdd ? '收起' : '+ 加好友'}
        </button>

        {/* 搜索加好友 */}
        {showAdd && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="输入完整的用户名或昵称"
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
              >
                {searching ? '搜索中' : '搜索'}
              </button>
            </div>

            {searchMessage && <p className="text-sm text-red-500 mt-2">{searchMessage}</p>}

            {searchResult && (
              <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{searchResult.nickname || searchResult.username}</p>
                  <p className="text-xs text-gray-500">{searchResult.username}</p>
                </div>
                <button
                  onClick={() => handleAddFriend(searchResult.id)}
                  className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                >
                  加为好友
                </button>
              </div>
            )}
          </div>
        )}

        {/* 好友申请 */}
        {requests.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">好友申请 ({requests.length})</h2>
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.friendship_id} className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.nickname || r.username}</p>
                    <p className="text-xs text-gray-500">{r.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(r.friendship_id)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      同意
                    </button>
                    <button
                      onClick={() => handleReject(r.friendship_id)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 好友列表 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">我的好友 ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-center text-gray-400 py-10 bg-white rounded-lg shadow">还没有好友，点上面加一个吧。</p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <Link
                  key={f.friendship_id}
                  href={`/friends/chat/${f.friend_id}`}
                  className="block bg-white p-4 rounded-lg shadow hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(f.nickname || f.username)[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{f.nickname || f.username}</p>
                      {f.signature && <p className="text-xs text-gray-500 truncate">{f.signature}</p>}
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}