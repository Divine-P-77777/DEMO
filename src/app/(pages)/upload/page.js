// Enhanced UploadTemplatePage component with reset, block removal, improved language detection
"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import php from 'highlight.js/lib/languages/php'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import ruby from 'highlight.js/lib/languages/ruby'
import dart from 'highlight.js/lib/languages/dart'
import shell from 'highlight.js/lib/languages/shell'
import rLang from 'highlight.js/lib/languages/r'
import perl from 'highlight.js/lib/languages/perl'
import lua from 'highlight.js/lib/languages/lua'
import haskell from 'highlight.js/lib/languages/haskell'
import elixir from 'highlight.js/lib/languages/elixir'
import scala from 'highlight.js/lib/languages/scala'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

import Editor from '@monaco-editor/react'
import { X } from 'lucide-react'
import CloudinaryUploader from '@/libs/Cloudinary'
import supabase from '@/libs/supabase/client'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('php', php)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('dart', dart)
hljs.registerLanguage('shell', shell)
hljs.registerLanguage('r', rLang)
hljs.registerLanguage('perl', perl)
hljs.registerLanguage('lua', lua)
hljs.registerLanguage('haskell', haskell)
hljs.registerLanguage('elixir', elixir)
hljs.registerLanguage('scala', scala)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)

const mostUsedLanguages = [
  "html", "css", "javascript", "typescript", "python", "java", "c", "cpp", "csharp",
  "php", "sql", "go", "rust", "kotlin", "swift", "ruby", "dart", "shell", "bash",
  "r", "perl", "assembly", "scala", "haskell", "elixir", "lua"
]


function Toggle({ pressed, onPressedChange, children }) {
    return (
        <button
            type="button"
            onClick={() => onPressedChange(!pressed)}
            className={`px-4 py-2 rounded border font-medium transition ${pressed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
            {children}
        </button>
    )
}

export default function UploadTemplatePage() {
    const [title, setTitle] = useState('')
    const [subtitle, setSubtitle] = useState('')
    const [visibility, setVisibility] = useState('private')
    const [codeBlocks, setCodeBlocks] = useState([{ id: uuidv4(), description: '', code: '', corrected: '', loading: false, language: '' }])
    const [loading, setLoading] = useState(false)
    const [image, setImage] = useState('')
    const router = useRouter()

    const addCodeBlock = () => {
        if (codeBlocks.length < 15) {
            setCodeBlocks([...codeBlocks, { id: uuidv4(), description: '', code: '', corrected: '', loading: false, language: '' }])
        }
    }

    const removeCodeBlock = (id) => {
        setCodeBlocks((prev) => prev.filter((b) => b.id !== id))
    }

    const updateCodeBlock = (id, key, value) => {
        setCodeBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, [key]: value } : b))
        )
    }

const detectLanguage = (code) => {
    const result = hljs.highlightAuto(code)
    const lang = result.language?.toLowerCase() || 'unknown'
    return mostUsedLanguages.includes(lang) ? lang : 'unknown'
}

    const fixCode = async (id) => {
        const block = codeBlocks.find((b) => b.id === id)
        if (!block) return

        updateCodeBlock(id, 'loading', true)

        try {
            const res = await fetch("https://api.devsdocode.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ddc-free-8e5171eeac9148ed89969cc31002d99d`
                },
                body: JSON.stringify({
                    model: "provider-1/gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "You are a multilingual code linter and formatter..."
                        },
                        { role: "user", content: block.code }
                    ]
                })
            })

            const data = await res.json()
            const reply = data.choices?.[0]?.message?.content?.trim() || ''

            updateCodeBlock(id, 'code', reply)
            updateCodeBlock(id, 'corrected', reply)
            updateCodeBlock(id, 'language', detectLanguage(reply))

            const user = (await supabase.auth.getUser()).data.user
            if (user) {
                await supabase.from('template_code_blocks').insert({
                    template_id: null,
                    description: block.description,
                    code: block.code,
                    corrected_code: reply,
                })
            }
        } catch (error) {
            console.error('Fix code error:', error)
        } finally {
            updateCodeBlock(id, 'loading', false)
        }
    }

    const handleSubmit = async () => {
        if (!image || !title.trim() || codeBlocks.every(b => !b.code.trim())) {
            alert("Image, title, and at least one code block with code are required.")
            return
        }

        setLoading(true)

        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) throw new Error('User not authenticated')

            const { data: template, error } = await supabase
                .from('templates')
                .insert({
                    user_id: user.id,
                    cover_image: image,
                    title,
                    subtitle,
                    visibility
                })
                .select()
                .single()

            if (error || !template) throw error

            const formattedBlocks = codeBlocks.map((b) => ({
                template_id: template.id,
                description: b.description,
                code: b.code,
                corrected_code: b.corrected || null
            }))

            await supabase.from('template_code_blocks').insert(formattedBlocks)

            // reset form
            setTitle('')
            setSubtitle('')
            setVisibility('private')
            setCodeBlocks([{ id: uuidv4(), description: '', code: '', corrected: '', loading: false, language: '' }])
            setImage('')

            router.push('/upload')
        } catch (err) {
            console.error('Submit template error:', err)
            alert("Failed to submit template.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Submit a Development Template</h1>

            <CloudinaryUploader
                previewClassName="rounded-xl shadow-md border mx-auto"
                required
                onUpload={(url) => setImage(url)}
            />

            {image && (
                <div className="mt-4">
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                        <p>Image uploaded successfully!</p>
                    </a>
                </div>
            )}

            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input placeholder="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

            <div className="flex gap-4 items-center">
                <span className="font-medium">Visibility:</span>
                <Toggle pressed={visibility === 'public'} onPressedChange={() => setVisibility(v => v === 'public' ? 'private' : 'public')}>
                    {visibility === 'public' ? 'Public' : 'Private'}
                </Toggle>
            </div>

            {codeBlocks.map((block, idx) => (
                <div key={block.id} className="relative bg-white rounded-md border p-4 space-y-4">
                    <button onClick={() => removeCodeBlock(block.id)} className="absolute top-2 right-2 text-red-600"><X size={18} /></button>
                    <textarea
                        placeholder={`Description for block ${idx + 1}`}
                        value={block.description}
                        onChange={(e) => updateCodeBlock(block.id, 'description', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                    />

                    <div className="relative">
                        {block.language && (
                            <span className="absolute top-0 right-0 mt-1 mr-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {block.language.toUpperCase()}
                            </span>
                        )}
                        <div className='flex justify-between gap-2 mb-2'>
                            <button
                                className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                                onClick={() => fixCode(block.id)}
                                disabled={block.loading}
                            >
                                {block.loading ? 'Fixing...' : 'Fix Code'}
                            </button>
                        </div>
                        <textarea
                            className="w-full resize-none overflow-hidden bg-gray-900 text-cyan-500 font-mono p-4 rounded-md"
                            value={block.code}
                            onChange={(e) => {
                                updateCodeBlock(block.id, "code", e.target.value)
                                updateCodeBlock(block.id, "language", detectLanguage(e.target.value))
                                e.target.style.height = "auto"
                                e.target.style.height = `${e.target.scrollHeight}px`
                            }}
                            onInput={(e) => {
                                e.target.style.height = "auto"
                                e.target.style.height = `${e.target.scrollHeight}px`
                            }}
                            placeholder="Write your code here..."
                            rows={1}
                        />
                    </div>
                </div>
            ))}

            <button onClick={addCodeBlock} disabled={codeBlocks.length >= 15}>
                + Add Code Block
            </button>

            <button
                onClick={handleSubmit}
                disabled={loading}
                className='mx-6 bg-blue-600 text-white text-xs px-2 py-1 rounded cursor-pointer'
            >
                {loading ? 'Submitting...' : 'Submit Template'}
            </button>
        </div>
    )
}