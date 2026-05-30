#!/usr/bin/env python3
"""
Parser de PDF de Atas de Resultado Final Escolar.
Extrai dados estruturados de PDFs de atas usando pdfplumber.
"""
import json
import sys
import re
import pdfplumber


# Mapeamento fixo de disciplinas (posições das colunas no PDF)
DEFAULT_DISCIPLINES = [
    "LÍNGUA PORTUGUESA",
    "ARTE",
    "EDUCAÇÃO FÍSICA",
    "LÍNGUA INGLESA",
    "MATEMÁTICA",
    "CIÊNCIAS",
    "GEOGRAFIA",
    "HISTÓRIA",
    "ENSINO RELIGIOSO",
    "EDUCAÇÃO FINANCEIRA"
]


def clean_number(val):
    """Converte número brasileiro com vírgula para float."""
    if val is None:
        return None
    val = str(val).strip().replace(",", ".")
    try:
        return float(val)
    except ValueError:
        return None


def parse_ata_pdf(pdf_path):
    """Parse um PDF de ata de resultado final e retorna dados estruturados."""
    result = {
        "school": {"name": "", "inep": "", "city": "", "state": "", "address": "", "cnpj": ""},
        "class": {"grade": "", "name": "", "shift": "", "minimum_average": 50.0},
        "students": [],
        "warnings": [],
        "disciplines": list(DEFAULT_DISCIPLINES)
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            text = page.extract_text() or ""

            # Extrair informações do cabeçalho (apenas da primeira página)
            if page_idx == 0:
                lines = text.split("\n")

                # Município e Estado
                for line in lines[:5]:
                    if "Mucuri" in line or "Prefeitura" in line:
                        result["school"]["city"] = "Mucuri"
                        if "Bahia" in line or "Bahia" in text[:500]:
                            result["school"]["state"] = "Bahia"

                # CNPJ
                cnpj_match = re.search(r"CNPJ[:\s]*(\d{2}[\./]\d{3}[\./]\d{3}[\/]\d{4}[-]\d{2})", text)
                if cnpj_match:
                    result["school"]["cnpj"] = cnpj_match.group(1)

                # Média mínima
                media_match = re.search(r"M[ÉE]DIA[:\s]*([\d]+[,][\d]+)", text)
                if media_match:
                    result["class"]["minimum_average"] = clean_number(media_match.group(1))

                # Turma: "6º ANO A - MATUTINO"
                turma_match = re.search(r"(\d+[º°]\s+ANO\s+[A-Z])\s*[-–]\s*(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)", text, re.IGNORECASE)
                if turma_match:
                    result["class"]["grade"] = turma_match.group(1).strip()
                    result["class"]["name"] = turma_match.group(1).split()[-1] if turma_match.group(1) else ""
                    result["class"]["shift"] = turma_match.group(2).upper()

                # Escola - melhor regex para pegar o nome corretamente
                escola_match = re.search(r"Escola:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
                if escola_match:
                    name = escola_match.group(1).strip()
                    # Limpar sujeiras
                    name = re.sub(r"\s+(Fundamental II.*)", "", name)
                    name = re.sub(r"\s+Turma:.*", "", name)
                    result["school"]["name"] = name.strip()

                # INEP
                inep_match = re.search(r"INEP\s+da\s+escola[:\s]*(\d+)", text, re.IGNORECASE)
                if inep_match:
                    result["school"]["inep"] = inep_match.group(1).strip()

                # Endereço
                addr_match = re.search(r"(AV\.[^|\n]+)", text)
                if addr_match:
                    result["school"]["address"] = addr_match.group(1).strip()

            # Extrair tabela de alunos
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 3:
                    continue

                # Processar linhas de alunos (começar da linha 2, após os cabeçalhos)
                for row_idx, row in enumerate(table):
                    if row_idx < 2:  # Pular cabeçalhos
                        continue

                    if not row or len(row) < 5:
                        continue

                    student_name = row[0]
                    if not student_name or not student_name.strip():
                        continue

                    # Verificar se é uma linha de dados válida (primeira nota deve ser numérica)
                    first_grade = row[3] if len(row) > 3 else None
                    if not first_grade or not any(c.isdigit() for c in str(first_grade)):
                        continue

                    birth_date = row[1]
                    if birth_date:
                        birth_date = birth_date.strip()
                        date_match = re.match(r"(\d{2})/(\d{2})/(\d{4})", birth_date)
                        if date_match:
                            birth_date = f"{date_match.group(3)}-{date_match.group(2)}-{date_match.group(1)}"

                    gender = (row[2] or "").strip().upper()
                    if gender == "M":
                        gender = "Masculino"
                    elif gender == "F":
                        gender = "Feminino"
                    else:
                        gender = None

                    # Extrair notas (10 colunas de disciplinas + 1 de resultado final)
                    grades = {}
                    zero_count = 0
                    total_grades = 0
                    num_disciplines = len(DEFAULT_DISCIPLINES)

                    for i in range(num_disciplines):
                        col_idx = 3 + i
                        if col_idx < len(row) - 1:
                            score = clean_number(row[col_idx])
                            if score is not None:
                                grades[DEFAULT_DISCIPLINES[i]] = score
                                total_grades += 1
                                if score == 0.0:
                                    zero_count += 1

                    # Resultado final (última coluna)
                    final_result = (row[-1] or "").strip().upper()
                    # Resultados válidos reconhecidos pelo sistema
                    VALID_RESULTS = ["APROVADO", "REPROVADO", "APROVADO POR CONSELHO", "EMC"]
                    if final_result not in VALID_RESULTS:
                        # Se o resultado estiver vazio ou não reconhecido, usa EMC (Em Curso)
                        final_result = "EMC"
                    # Como os dados são parciais (1º trimestre de 3), "REPROVADO" não é definitivo
                    # Converter para "EMC" (Em Curso da Mensalidade Complementar)
                    if final_result == "REPROVADO":
                        final_result = "EMC"

                    student = {
                        "name": student_name.strip(),
                        "birth_date": birth_date,
                        "gender": gender,
                        "grades": grades,
                        "final_result": final_result,
                        "zero_count": zero_count,
                        "total_grades": total_grades
                    }

                    result["students"].append(student)

                    # Detectar inconsistências
                    if total_grades == 0:
                        result["warnings"].append({
                            "type": "missing_grade",
                            "student": student_name.strip(),
                            "message": f"Aluno {student_name.strip()} sem nenhuma nota"
                        })
                    if zero_count > 5:
                        result["warnings"].append({
                            "type": "zero_grades",
                            "student": student_name.strip(),
                            "message": f"Aluno {student_name.strip()} tem {zero_count} notas zeradas de {total_grades}"
                        })

        # Detectar inconsistências globais
        if result["students"]:
            all_failed = all(s["final_result"] == "REPROVADO" for s in result["students"])
            if all_failed:
                result["warnings"].append({
                    "type": "class_all_failed",
                    "student": None,
                    "message": "Todos os alunos da turma foram reprovados"
                })

            # Verificar disciplinas críticas (mais de 70% zeros)
            for disc in DEFAULT_DISCIPLINES:
                total = 0
                zeros = 0
                for s in result["students"]:
                    if disc in s["grades"]:
                        total += 1
                        if s["grades"][disc] == 0.0:
                            zeros += 1
                if total > 0 and zeros / total > 0.7:
                    result["warnings"].append({
                        "type": "critical_subject",
                        "student": None,
                        "message": f"Disciplina {disc}: {zeros}/{total} notas zeradas ({int(zeros/total*100)}%)"
                    })

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python parse_ata.py <caminho_do_pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = parse_ata_pdf(pdf_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
