import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";
import { withAuth } from "@/lib/auth/with-auth";
import { requireRunPermission } from "@/lib/auth/require-run-permission";
import { getS3Client, getS3Config } from "@/lib/s3";

export const DELETE = withAuth(null, async (_req, { userId, globalRoles, activeOrganizationId, organizationRole }, routeCtx) => {
    const { id, artifactId } = await routeCtx.params;
    const access = await requireRunPermission(userId, globalRoles, id, PERMISSIONS.ARTIFACT_DELETE, activeOrganizationId, organizationRole);
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
});
