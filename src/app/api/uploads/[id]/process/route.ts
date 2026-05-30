import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseAtaPdf } from '@/lib/pdfParser';
import { getPdfUploadPath } from '@/lib/paths';
import { DATA_WRITE_ROLES, jsonError, requireRoles, requireUser } from '@/lib/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser(request);
    requireRoles(currentUser, DATA_WRITE_ROLES);

    const { id } = await params;

    const upload = await db.upload.findUnique({
      where: { id },
    });

    if (!upload) {
      return NextResponse.json({ error: 'Upload não encontrado' }, { status: 404 });
    }

    // Update status to processing
    await db.upload.update({
      where: { id },
      data: { status: 'processing', errorMessage: null },
    });

    try {
      const pdfPath = getPdfUploadPath(upload.filename);

      // Parse the PDF
      const result = await parseAtaPdf(pdfPath);

      // Create or find the school
      let school;
      if (result.school.name) {
        school = await db.school.upsert({
          where: { inep: result.school.inep || `__no_inep__${result.school.name}` },
          update: {
            name: result.school.name,
            city: result.school.city,
            state: result.school.state,
            address: result.school.address,
            cnpj: result.school.cnpj,
          },
          create: {
            name: result.school.name,
            inep: result.school.inep || null,
            city: result.school.city,
            state: result.school.state,
            address: result.school.address,
            cnpj: result.school.cnpj,
          },
        });

        // Fix: if the upsert didn't work because of null inep, try a different approach
        if (!school && !result.school.inep) {
          const existingSchool = await db.school.findFirst({
            where: { name: result.school.name },
          });
          if (existingSchool) {
            school = existingSchool;
          } else {
            school = await db.school.create({
              data: {
                name: result.school.name,
                inep: result.school.inep || null,
                city: result.school.city,
                state: result.school.state,
                address: result.school.address,
                cnpj: result.school.cnpj,
              },
            });
          }
        }
      }

      // Create or find the class
      let schoolClass;
      if (school && result.class.grade) {
        schoolClass = await db.schoolClass.upsert({
          where: {
            schoolId_grade_name_shift_year: {
              schoolId: school.id,
              grade: result.class.grade,
              name: result.class.name || 'A',
              shift: result.class.shift || 'MATUTINO',
              year: new Date().getFullYear(),
            },
          },
          update: {
            minimumAverage: result.class.minimum_average,
          },
          create: {
            schoolId: school.id,
            grade: result.class.grade,
            name: result.class.name || 'A',
            shift: result.class.shift || 'MATUTINO',
            minimumAverage: result.class.minimum_average,
            year: new Date().getFullYear(),
          },
        });
      }

      // Create subjects
      const subjectIds: Record<string, string> = {};
      for (const discipline of result.disciplines) {
        const subject = await db.subject.upsert({
          where: { name: discipline },
          update: {},
          create: { name: discipline },
        });
        subjectIds[discipline] = subject.id;
      }

      let studentsCreated = 0;
      let studentsUpdated = 0;

      for (const studentData of result.students) {
        // Check for existing student in the SAME CLASS (not same upload)
        // This ensures re-uploading a PDF updates existing data instead of duplicating
        const existingStudent = schoolClass
          ? await db.student.findFirst({
              where: {
                name: studentData.name,
                classId: schoolClass.id,
              },
              include: { grades: true },
            })
          : null;

        let student;

        if (existingStudent) {
          // UPDATE existing student data
          student = await db.student.update({
            where: { id: existingStudent.id },
            data: {
              birthDate: studentData.birth_date,
              gender: studentData.gender,
              finalResult: studentData.final_result,
              schoolId: school?.id || null,
              classId: schoolClass?.id || null,
            },
          });
          studentsUpdated++;

          // Delete old grades to replace with new ones
          if (existingStudent.grades.length > 0) {
            await db.grade.deleteMany({
              where: { studentId: student.id },
            });
          }
        } else {
          // CREATE new student
          student = await db.student.create({
            data: {
              name: studentData.name,
              birthDate: studentData.birth_date,
              gender: studentData.gender,
              finalResult: studentData.final_result,
              uploadId: id,
              schoolId: school?.id || null,
              classId: schoolClass?.id || null,
            },
          });
          studentsCreated++;
        }

        // Create grades (new or replacement)
        for (const [discipline, score] of Object.entries(studentData.grades)) {
          const subjectId = subjectIds[discipline];
          if (subjectId) {
            await db.grade.upsert({
              where: {
                studentId_subjectId: {
                  studentId: student.id,
                  subjectId,
                },
              },
              update: { score: score as number },
              create: {
                studentId: student.id,
                subjectId,
                score: score as number,
              },
            });
          }
        }
      }

      // Clean up inconsistencies from previous uploads of the same class
      if (schoolClass) {
        // Get all upload IDs for this class
        const previousUploads = await db.upload.findMany({
          where: { classId: schoolClass.id },
          select: { id: true },
        });
        const previousUploadIds = previousUploads.map((u) => u.id);

        if (previousUploadIds.length > 0) {
          await db.inconsistency.deleteMany({
            where: { uploadId: { in: previousUploadIds } },
          });
        }
      }

      // Create inconsistencies from warnings (fresh set)
      for (const warning of result.warnings) {
        let studentId: string | undefined;

        if (warning.student && schoolClass) {
          const student = await db.student.findFirst({
            where: {
              name: warning.student,
              classId: schoolClass.id,
            },
          });
          if (student) {
            studentId = student.id;
          }
        }

        await db.inconsistency.create({
          data: {
            uploadId: id,
            type: warning.type,
            message: warning.message,
            studentId: studentId || null,
          },
        });
      }

      // Update upload record
      await db.upload.update({
        where: { id },
        data: {
          status: 'processed',
          errorMessage: null,
          schoolId: school?.id || null,
          classId: schoolClass?.id || null,
        },
      });

      const isUpdate = studentsUpdated > 0;

      return NextResponse.json({
        success: true,
        message: isUpdate
          ? `Dados atualizados com sucesso (${studentsUpdated} aluno(s) atualizado(s), ${studentsCreated} novo(s))`
          : 'PDF processado com sucesso',
        data: {
          school: school?.name,
          class: schoolClass ? `${schoolClass.grade} - ${schoolClass.shift}` : null,
          studentsProcessed: studentsCreated,
          studentsUpdated,
          warnings: result.warnings.length,
        },
      });
    } catch (processError) {
      console.error('Erro ao processar PDF:', processError);
      await db.upload.update({
        where: { id },
        data: {
          status: 'error',
          errorMessage: processError instanceof Error ? processError.message : 'Erro desconhecido',
        },
      });

      return NextResponse.json(
        {
          error: 'Erro ao processar o PDF',
          details: processError instanceof Error ? processError.message : 'Erro desconhecido',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && 'status' in error) return jsonError(error);
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
