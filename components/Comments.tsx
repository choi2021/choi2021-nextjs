'use client'

import { Comments as CommentsComponent } from 'pliny/comments'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import siteMetadata from '@/data/siteMetadata'

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false)
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    if (loadComments && siteMetadata.comments?.provider === 'cusdis') {
      const themeMode = resolvedTheme === 'dark' ? 'dark' : 'light'
      // @ts-ignore
      if (window.CUSDIS) {
        // @ts-ignore
        window.CUSDIS.setTheme(themeMode)
      }
    }
  }, [resolvedTheme, loadComments])

  if (!siteMetadata.comments?.provider) {
    return null
  }

  return (
    <>
      {loadComments ? (
        siteMetadata.comments.provider === 'cusdis' ? (
          <div className="py-6 text-center text-gray-700 dark:text-gray-300">
            <div
              id="cusdis_thread"
              data-host={siteMetadata.comments.cusdisConfig.host}
              data-app-id={siteMetadata.comments.cusdisConfig.appId}
              data-page-id={slug}
              data-page-url={`${siteMetadata.siteUrl}/blog/${slug}`}
              data-page-title={slug}
              data-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            ></div>
            <script async defer src="https://cusdis.com/js/cusdis.es.js"></script>
          </div>
        ) : (
          <CommentsComponent commentsConfig={siteMetadata.comments} slug={slug} />
        )
      ) : (
        <button
          className="rounded bg-primary-500 px-4 py-2 font-bold text-white hover:bg-primary-600 dark:hover:bg-primary-400"
          onClick={() => setLoadComments(true)}
        >
          댓글 불러오기
        </button>
      )}
    </>
  )
}
