import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
    getGlobalRoles,
    getProjectRole,
    hasProjectPermission,
    isReadOnlyGlobal,
    isSuperAdmin,
} from "@/lib/permissions";
import { getS3Client, getS3Config } from "@/lib/s3";

type RouteParams = {
    params: Promise<{
        id: string;
        artifactId: string;
    }>;
};

async function requireRunEditor(userId: string, runId: string) {
    const run = await prisma.testRun.findUnique({
        where: { id: runId },
        select: { id: true, projectId: true },
    });

    if (!run) {
        return {
            error: NextResponse.json(
                { message: "Run no encontrado." },
                { status: 404 },
            ),
        };
    }

    const globalRoles = await getGlobalRoles(userId);
    if (isSuperAdmin(globalRoles)) {
        return { run };
    }

    if (isReadOnlyGlobal(globalRoles)) {
        return {
            error: NextResponse.json({ message: "Solo lectura." }, { status: 403 }),
        };
    }

    const role = await getProjectRole(userId, run.projectId);
    if (!hasProjectPermission(role, "editor")) {
        return {
            error: NextResponse.json(
                { message: "No tienes permisos en este proyecto." },
                { status: 403 },
            ),
        };
    }

    return { run };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }

    const { id, artifactId } = await params;
    const access = await requireRunEditor(session.user.id, id);
    if (access.error) return access.error;

    try {
        const artifact = await prisma.testRunArtifact.findUnique({
            where: { id: artifactId },
        });

        if (!artifact) {
            return NextResponse.json(
                { message: "Artefacto no encontrado." },
                { status: 404 },
            );
        }

        if (artifact.runId !== id) {
            return NextResponse.json(
                { message: "El artefacto no pertenece a este run." },
                { status: 400 },
            );
        }

        // Delete from S3
        const { bucket, publicUrl } = getS3Config();
        const bucketPrefix = `${publicUrl.replace(/\/$/, "")}/${bucket}/`;

        if (artifact.url.startsWith(bucketPrefix)) {
            const encodedKey = artifact.url.slice(bucketPrefix.length);
            const key = decodeURI(encodedKey);

            const client = getS3Client();
            await client.send(
                new DeleteObjectCommand({
                    Bucket: bucket,
                    Key: key,
                })
            );
        }

        // Delete from DB
        await prisma.testRunArtifact.delete({
            where: { id: artifactId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting artifact:", error);
        return NextResponse.json(
            { message: "No se pudo eliminar el artefacto." },
            { status: 500 },
        );
    }
}
