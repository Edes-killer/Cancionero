import { NextRequest, NextResponse } from "next/server"
import { buscarVersiculos } from "@/lib/biblia"

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get("ref")

    if (!ref) {
      return NextResponse.json(
        { error: "Falta parámetro ref" },
        { status: 400 }
      )
    }

    const resultado = await buscarVersiculos(ref)

    return NextResponse.json(resultado)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado"
      },
      { status: 400 }
    )
  }
}