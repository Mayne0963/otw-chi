import { verifyClerkToken } from '@clerk/mcp-tools/next'
import { createMcpHandler, withMcpAuth } from '@vercel/mcp-adapter'
import { auth, clerkClient } from '@clerk/nextjs/server'

const clerk = await clerkClient()