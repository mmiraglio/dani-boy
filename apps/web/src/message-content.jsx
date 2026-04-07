import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

const BLOCK_MATH_PATTERN = /\\\[\s*([\s\S]*?)\s*\\\]/g;
const INLINE_MATH_PATTERN = /\\\(\s*([\s\S]*?)\s*\\\)/g;
const ARITHMETIC_VALUE_PATTERN = /^\d[\d., ]*$/;
const ARITHMETIC_OPERATION_PATTERN = /^([+-])\s*(\d[\d., ]*)$/;
const ARITHMETIC_SEPARATOR_PATTERN = /^[-_=]{3,}$/;

export function normalizeMathDelimiters(content) {
  return content
    .replace(BLOCK_MATH_PATTERN, (_match, expression) => {
      const normalizedExpression = expression.trim();
      return normalizedExpression
        ? `\n$$\n${normalizedExpression}\n$$\n`
        : "";
    })
    .replace(INLINE_MATH_PATTERN, (_match, expression) => {
      const normalizedExpression = expression.trim();
      return normalizedExpression ? `$${normalizedExpression}$` : "";
    });
}

function parseArithmeticBlock(content) {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || lines.length > 4) {
    return null;
  }

  const [topLine, operationLine, thirdLine, fourthLine] = lines;

  if (!ARITHMETIC_VALUE_PATTERN.test(topLine)) {
    return null;
  }

  const operationMatch = operationLine.match(ARITHMETIC_OPERATION_PATTERN);

  if (!operationMatch) {
    return null;
  }

  let resultLine = null;

  if (typeof thirdLine === "string") {
    if (ARITHMETIC_SEPARATOR_PATTERN.test(thirdLine)) {
      if (typeof fourthLine === "string") {
        if (!ARITHMETIC_VALUE_PATTERN.test(fourthLine)) {
          return null;
        }

        resultLine = fourthLine;
      }
    } else if (ARITHMETIC_VALUE_PATTERN.test(thirdLine) && typeof fourthLine !== "string") {
      resultLine = thirdLine;
    } else {
      return null;
    }
  }

  const [, operator, bottomLine] = operationMatch;

  return {
    bottomLine,
    operator,
    resultLine,
    topLine
  };
}

function ArithmeticBlock({ bottomLine, operator, resultLine, topLine }) {
  return (
    <div className="arithmetic-block-wrapper">
      <table
        aria-label={`Conta armada: ${topLine} ${operator} ${bottomLine}${resultLine ? ` = ${resultLine}` : ""}`}
        className="arithmetic-block"
      >
        <tbody>
          <tr>
            <td className="arithmetic-operator-cell" aria-hidden="true" />
            <td className="arithmetic-digits-cell">{topLine}</td>
          </tr>
          <tr className="arithmetic-row-operation">
            <td className="arithmetic-operator-cell">{operator}</td>
            <td className="arithmetic-digits-cell">{bottomLine}</td>
          </tr>
          {resultLine ? (
            <tr className="arithmetic-row-result">
              <td className="arithmetic-operator-cell" aria-hidden="true" />
              <td className="arithmetic-digits-cell">{resultLine}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function MessageContent({ content }) {
  return (
    <div className="message-content">
      <ReactMarkdown
        components={{
          code({ children, className, inline, ...props }) {
            const value = String(children).replace(/\n$/, "");
            const isArithmeticBlock =
              !inline &&
              (className === "language-calc" || className === "language-conta");

            if (isArithmeticBlock) {
              const arithmeticBlock = parseArithmeticBlock(value);

              if (arithmeticBlock) {
                return <ArithmeticBlock {...arithmeticBlock} />;
              }
            }

            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <pre>
                <code className={className} {...props}>
                  {value}
                </code>
              </pre>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          }
        }}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
